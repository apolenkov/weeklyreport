import {
  currentPeriodLifecycleSchema,
  type PeriodState,
  type PeriodStatus,
  type ReportStatus,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { PeriodLifecycleIntegrityError } from "../../period/index.js";
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
) {
  return periodOverlapGuarded(() =>
    prisma.$transaction(async (tx) => {
      const lifecycle = await lockLifecycle(tx, input.reportId);
      assertUpdateAllowed(lifecycle, input.expectedPeriodState, input.data);
      return writeManualUpdate(tx, input.reportId, lifecycle, input.data);
    }),
  );
}
