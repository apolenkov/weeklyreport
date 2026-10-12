import { Prisma } from "@prisma/client";
import {
  draftSaveSchema,
  type ItemOutcomeResult,
  MAX_RECORDS_PER_SECTION_SAVE,
  type PromotePlanInput,
  type ReportSectionReadModel,
  type ResolvePlanInput,
  type RestorePlanInput,
  validateRecordActivityIds,
  validateStageOwnership,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { ReportSectionDomainError } from "../application/report-sections.service.js";
import {
  promoteItemTransition,
  resolveItemTransition,
  restoreItemTransition,
} from "../domain/item-outcome-transition.js";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
} from "../domain/lead-form-shared.js";
import { resolveOutcomeSource } from "./item-outcome-source.js";
import {
  advanceOutcomeVersion,
  loadOutcomeTarget,
  readOutcomeResult,
} from "./item-outcome-target.js";
import { writeResolvedOutcome } from "./item-outcome-write.js";

type Item = ReportSectionReadModel["items"][number];

export function outcomeCandidate(
  source: Item,
  command: ResolvePlanInput,
  transition: ReturnType<typeof resolveItemTransition>,
) {
  const projectId =
    command.parent === undefined
      ? (source.projectId ?? null)
      : command.parent.kind === "product"
        ? command.parent.id
        : null;
  const activityId =
    command.parent === undefined
      ? (source.activityId ?? null)
      : command.parent.kind === "activity"
        ? command.parent.id
        : null;
  return {
    ...source,
    ...transition.afterState,
    text: transition.text,
    projectId,
    activityId,
    stageNames:
      command.stageNames ?? (activityId !== null ? [] : source.stageNames),
    priorityRank:
      command.priorityRank !== undefined
        ? command.priorityRank
        : (source.priorityRank ?? null),
    // Every explicit outcome acknowledges the carried occurrence. Clear the
    // marker in the same transaction as the outcome and its audit event.
    carriedOver: false,
    resolution: null,
    outcomeHistory: [],
  };
}

function validateOutcomeItem(
  section: ReportSectionReadModel,
  item: ReportSectionReadModel["items"][number],
) {
  const input = draftSaveSchema.parse({
    reportSectionId: section.reportSectionId,
    version: section.version,
    projectStatuses: [],
    items: [item],
    risks: [],
    decisions: [],
  });
  const violation =
    validateStageOwnership(section, input)[0] ??
    validateRecordActivityIds(section, input)[0];
  if (violation)
    throw new ReportSectionDomainError(violation.code, violation.message);
}

export async function resolvePlanTx(
  prisma: PrismaService,
  command: ResolvePlanInput,
  userId: string,
): Promise<ItemOutcomeResult> {
  return prisma.$transaction(
    async (tx) => {
      const target = await loadOutcomeTarget(tx, command, userId, "resolve");
      if (target.replay) return target.replay;
      const source = await resolveOutcomeSource(tx, target.section, command);
      const stableId = source.stableId;
      if (!stableId)
        throw new LeadFormDomainError("This plan has no durable identity.");
      if (
        command.source.kind === "prior" &&
        target.section.items.length >= MAX_RECORDS_PER_SECTION_SAVE
      ) {
        throw new LeadFormConstraintError(
          "This section has reached its item limit.",
        );
      }
      const transition = resolveItemTransition(source, command);
      const candidate = outcomeCandidate(source, command, transition);
      validateOutcomeItem(target.section, candidate);
      // Source locks precede the write trigger's shared semantic-generation row.
      await advanceOutcomeVersion(tx, command);
      await writeResolvedOutcome(tx, command, {
        sectionId: target.section.reportSectionId,
        requestHash: target.requestHash,
        actor: target.actor,
        stableId,
        transition,
        candidate,
      });
      return readOutcomeResult(tx, target.section.reportSectionId, stableId);
    },
    { timeout: 15_000 },
  );
}

export async function restorePlanTx(
  prisma: PrismaService,
  command: RestorePlanInput,
  userId: string,
): Promise<ItemOutcomeResult> {
  return prisma.$transaction(
    async (tx) => {
      const target = await loadOutcomeTarget(tx, command, userId, "restore");
      if (target.replay) return target.replay;
      const source = target.section.items.find(
        (item) => item.id === command.recordId,
      );
      if (!source?.stableId)
        throw new LeadFormDomainError(
          "This plan is no longer available. Reload the report.",
        );
      const transition = restoreItemTransition(source);
      validateOutcomeItem(target.section, {
        ...source,
        ...transition.afterState,
        text: transition.afterState.text ?? source.text,
        resolution: null,
      });
      await advanceOutcomeVersion(tx, command);
      await tx.itemOutcomeEvent.create({
        data: {
          id: command.commandId,
          reportSectionId: target.section.reportSectionId,
          stableId: source.stableId,
          requestHash: target.requestHash,
          outcome: "restore",
          actorId: target.actor.id,
          actorName: target.actor.name,
          beforeState: transition.beforeState,
          afterState: transition.afterState,
          reversesEventId: transition.reversesEventId,
        },
      });
      await tx.item.update({
        where: {
          reportSectionId_stableId: {
            reportSectionId: target.section.reportSectionId,
            stableId: source.stableId,
          },
        },
        data: {
          ...transition.afterState,
          text: transition.afterState.text ?? source.text,
          resolution: Prisma.DbNull,
        },
      });
      return readOutcomeResult(
        tx,
        target.section.reportSectionId,
        source.stableId,
      );
    },
    { timeout: 15_000 },
  );
}

// One transaction replaces the active result with the linked commitment,
// consumes it and appends the audit event whose before-state keeps the
// superseded result readable. Moving to Next preserves workflow state.
export async function promotePlanTx(
  prisma: PrismaService,
  command: PromotePlanInput,
  userId: string,
): Promise<ItemOutcomeResult> {
  return prisma.$transaction(
    async (tx) => {
      const target = await loadOutcomeTarget(tx, command, userId, "promote");
      if (target.replay) return target.replay;
      const source = target.section.items.find(
        (item) => item.id === command.recordId,
      );
      if (!source?.stableId)
        throw new LeadFormDomainError(
          "This record is no longer available. Reload the report.",
        );
      const transition = promoteItemTransition(source, command.target);
      validateOutcomeItem(target.section, {
        ...source,
        ...transition.afterState,
        text: transition.afterState.text ?? source.text,
        resolution: null,
      });
      await advanceOutcomeVersion(tx, command);
      await tx.itemOutcomeEvent.create({
        data: {
          id: command.commandId,
          reportSectionId: target.section.reportSectionId,
          stableId: source.stableId,
          requestHash: target.requestHash,
          outcome: command.target === "next" ? "plan_next" : "promote",
          actorId: target.actor.id,
          actorName: target.actor.name,
          beforeState: transition.beforeState,
          afterState: transition.afterState,
          reversesEventId: null,
        },
      });
      await tx.item.update({
        where: {
          reportSectionId_stableId: {
            reportSectionId: target.section.reportSectionId,
            stableId: source.stableId,
          },
        },
        data: {
          ...transition.afterState,
          text: transition.afterState.text ?? source.text,
          carriedOver: false,
          resolution: Prisma.DbNull,
        },
      });
      return readOutcomeResult(
        tx,
        target.section.reportSectionId,
        source.stableId,
      );
    },
    { timeout: 15_000 },
  );
}
