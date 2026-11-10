import type { Prisma } from "@prisma/client";
import {
  mapPrismaToAuthorReportSection,
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "@weeklyreport/report-persistence";
import type {
  ItemOutcomeResult,
  PromotePlanInput,
  ResolvePlanInput,
  RestorePlanInput,
} from "@weeklyreport/shared";

import { lockCurrentEditableReport } from "../../../lib/report-lifecycle.js";
import { lockStatusGraph } from "../../../lib/status-graph-lock.js";
import { SectionVersionConflictError } from "../application/report-sections.service.js";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
} from "../domain/lead-form-shared.js";
import {
  outcomeCommandHash,
  type OutcomeCommandOperation,
} from "./item-outcome-command-hash.js";
import { privateDraftOwnerWhere } from "./private-draft-entitlement.js";

type Command = ResolvePlanInput | RestorePlanInput | PromotePlanInput;
const SECTION_UNAVAILABLE = "The report section is not available.";
const VERSION_CONFLICT =
  "This section changed. Reload it before resolving the plan.";

function receiptMatches(
  receipt: {
    readonly reportSectionId: string;
    readonly actorId: string;
    readonly outcome: string;
    readonly requestHash: string;
  },
  expected: {
    readonly reportSectionId: string;
    readonly userId: string;
    readonly operation: OutcomeCommandOperation;
    readonly requestHash: string;
  },
): boolean {
  const { reportSectionId, userId, operation, requestHash } = expected;
  return (
    receipt.reportSectionId === reportSectionId &&
    receipt.actorId === userId &&
    (operation !== "restore" || receipt.outcome === "restore") &&
    receipt.requestHash === requestHash
  );
}

export async function loadOutcomeTarget(
  tx: Prisma.TransactionClient,
  command: Command,
  userId: string,
  operation: OutcomeCommandOperation,
) {
  // Prisma's callback deadline cannot interrupt an in-flight pg lock wait.
  await tx.$executeRaw`SET LOCAL lock_timeout = '15s'`;
  await lockStatusGraph(tx);
  const gate = await lockCurrentEditableReport(tx, {
    sectionId: command.reportSectionId,
  });
  const row = await tx.reportSection.findUnique({
    where: { id: command.reportSectionId },
    include: reportSectionFullInclude,
  });
  if (row?.authorId !== userId || gate.kind === "not-found") {
    throw new LeadFormDomainError(SECTION_UNAVAILABLE);
  }
  const actor = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isActive: true },
  });
  if (!actor?.isActive) throw new LeadFormDomainError(SECTION_UNAVAILABLE);
  const section = mapPrismaToReportSection(row);
  const requestHash = outcomeCommandHash(command, operation);
  const receipt = await tx.itemOutcomeEvent.findUnique({
    where: { id: command.commandId },
  });
  if (receipt) {
    if (
      !receiptMatches(receipt, {
        reportSectionId: row.id,
        userId,
        operation,
        requestHash,
      })
    ) {
      throw new LeadFormConstraintError(
        "This command identifier has already been used for another action.",
      );
    }
    return {
      section,
      actor,
      requestHash,
      replay: {
        section: await authorFormSectionOf(tx, row, userId),
        stableId: receipt.stableId,
        replayed: true,
      } satisfies ItemOutcomeResult,
    };
  }
  if (gate.kind !== "editable" || row.status !== "draft") {
    throw new LeadFormConstraintError(
      "Plan outcomes can only be changed in an editable draft.",
    );
  }
  if (row.version !== command.version) {
    throw new SectionVersionConflictError(VERSION_CONFLICT);
  }
  return { section, actor, requestHash, replay: null };
}

export async function advanceOutcomeVersion(
  tx: Prisma.TransactionClient,
  command: Command,
): Promise<void> {
  const changed = await tx.reportSection.updateMany({
    where: {
      id: command.reportSectionId,
      version: command.version,
      status: "draft",
    },
    data: { version: { increment: 1 } },
  });
  if (changed.count !== 1) {
    throw new SectionVersionConflictError(VERSION_CONFLICT);
  }
}

// The result re-bases the author's form, which holds their unfinished risks
// and decisions: the complete projection would make the form drop them and
// the next autosave would then be refused for omitting them. Anyone without
// the private-draft entitlement keeps the complete projection.
async function authorFormSectionOf(
  tx: Prisma.TransactionClient,
  row: Prisma.ReportSectionGetPayload<{
    include: typeof reportSectionFullInclude;
  }>,
  actorId: string,
): Promise<ItemOutcomeResult["section"]> {
  const entitled = await tx.reportSection.findFirst({
    where: { id: row.id, ...privateDraftOwnerWhere(actorId) },
    select: { id: true },
  });
  return entitled
    ? mapPrismaToAuthorReportSection(row)
    : mapPrismaToReportSection(row);
}

export async function readOutcomeResult(
  tx: Prisma.TransactionClient,
  reportSectionId: string,
  stableId: string,
  actorId: string,
): Promise<ItemOutcomeResult> {
  const row = await tx.reportSection.findUnique({
    where: { id: reportSectionId },
    include: reportSectionFullInclude,
  });
  if (!row) throw new LeadFormDomainError(SECTION_UNAVAILABLE);
  return {
    section: await authorFormSectionOf(tx, row, actorId),
    stableId,
    replayed: false,
  };
}
