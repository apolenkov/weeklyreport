import type { Prisma } from "@prisma/client";
import {
  currentPeriodLifecycleSchema,
  type PeriodState,
  type PeriodStatus,
  type ReportStatus,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { lockStatusGraph } from "../../../lib/status-graph-lock.js";
import { PeriodLifecycleIntegrityError } from "../../period/index.js";
import {
  lockAllReminderPolicies,
  reconcileLockedPolicyForReport,
} from "../../reminders/index.js";
import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodStaleStateError,
} from "../admin-shared.js";
import { periodOverlapGuarded } from "./overlap.js";

interface ManualUpdateData {
  periodStart?: Date;
  periodEnd?: Date;
  deadline?: Date | null;
  weekLabel?: string | null;
}

interface LockedLifecycle {
  status: ReportStatus;
  periodState: PeriodState;
  periodStatus: PeriodStatus;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  publishedAt: Date | null;
  publishedById: string | null;
  reopenedAt: Date | null;
}

async function lockLifecycle(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<LockedLifecycle> {
  const rows = await tx.$queryRaw<LockedLifecycle[]>`
    SELECT "status", "periodState", "periodStatus", "archived",
      "autoPublished", "autoArchived", "publishedAt", "publishedById",
      "reopenedAt"
    FROM "Report" WHERE "id" = ${reportId} FOR UPDATE`;
  const row = rows[0];
  if (row === undefined) {
    throw new AdminPeriodNotFoundError(`Report ${reportId} not found.`);
  }
  const lifecycle = currentPeriodLifecycleSchema.safeParse(row);
  if (!lifecycle.success) throw new PeriodLifecycleIntegrityError();
  return lifecycle.data;
}

function hasEnvelopeEdit(data: ManualUpdateData): boolean {
  return (
    data.periodStart !== undefined ||
    data.periodEnd !== undefined ||
    data.deadline !== undefined
  );
}

function assertUpdateAllowed(
  lifecycle: LockedLifecycle,
  expectedPeriodState: PeriodState,
  data: ManualUpdateData,
): void {
  if (!hasEnvelopeEdit(data)) return;
  if (lifecycle.periodState !== expectedPeriodState) {
    throw new AdminPeriodStaleStateError(
      "The period changed while it was being edited. Reload and try again.",
    );
  }
  if (
    lifecycle.periodState === "published" ||
    lifecycle.periodState === "archived"
  ) {
    throw new AdminAccessError(
      "Cannot edit a published or archived period's dates. Reopen or unarchive it first if needed.",
    );
  }
}

async function writeManualUpdate(
  tx: Prisma.TransactionClient,
  reportId: string,
  lifecycle: LockedLifecycle,
  data: ManualUpdateData,
) {
  const { count } = await tx.report.updateMany({
    where: { id: reportId, ...lifecycle },
    data,
  });
  if (count !== 1) {
    throw new AdminPeriodStaleStateError(
      "The period changed while it was being edited. Reload and try again.",
    );
  }
  return tx.report.findUniqueOrThrow({
    where: { id: reportId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      deadline: true,
      weekLabel: true,
      periodState: true,
      status: true,
      periodStatus: true,
      archived: true,
    },
  });
}

// Patch an existing Report's date envelope + weekLabel. The service has already
// filtered `data` down to actually-changed fields, so Prisma's partial-update
// semantics are exactly right. `periodState` is never touched here.
export async function updatePeriodManual(
  prisma: PrismaService,
  input: {
    reportId: string;
    expectedPeriodState: PeriodState;
    data: ManualUpdateData;
  },
  now: Date = new Date(),
) {
  return periodOverlapGuarded(() =>
    prisma.$transaction(async (tx) => {
      // Period coordinates order outcome lineage, so envelope moves share the
      // same barrier as section writes before either side locks Report rows.
      await lockStatusGraph(tx);
      // Deadline writers share the same policy-first order as policy saves and
      // the applicator. A week-label/envelope-only edit needs no policy lock.
      const policies =
        input.data.deadline === undefined
          ? []
          : await lockAllReminderPolicies(tx);
      const lifecycle = await lockLifecycle(tx, input.reportId);
      assertUpdateAllowed(lifecycle, input.expectedPeriodState, input.data);
      const updated = await writeManualUpdate(
        tx,
        input.reportId,
        lifecycle,
        input.data,
      );
      for (const policy of policies) {
        await reconcileLockedPolicyForReport(
          tx,
          policy,
          {
            id: updated.id,
            deadline: updated.deadline,
            periodState: updated.periodState,
            status: updated.status,
            periodStatus: updated.periodStatus,
            archived: updated.archived,
          },
          now,
        );
      }
      return updated;
    }),
  );
}
