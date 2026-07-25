import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import type {
  CarryOverExecution as PrismaCarryOverExecutionRow,
  Prisma,
} from "@prisma/client";

import {
  CarryOverConflictError,
  type CarryOverResult,
  isTargetEditable,
} from "./carry-over.service";
import {
  persistCarriedRowsForSection,
  requirePrimaryTargetSection,
} from "./carry-over-row-writes";

export function mapPrismaToExecution(row: {
  id: string;
  sourceReportId: string;
  targetReportId: string;
  dedupeKey: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  records: {
    id: string;
    executionId: string;
    sourceItemId: string | null;
    sourceDecisionId: string | null;
    targetItemId: string | null;
    targetDecisionId: string | null;
    recordType: string;
    createdAt: Date;
  }[];
}): { execution: CarryOverExecution; records: CarryOverRecord[] } {
  const execution = carryOverExecutionSchema.parse({
    id: row.id,
    sourceReportId: row.sourceReportId,
    targetReportId: row.targetReportId,
    dedupeKey: row.dedupeKey,
    status: row.status,
    startedAt: row.createdAt,
    completedAt: row.updatedAt,
    carriedItemCount: row.records.filter((r) => r.recordType === "item").length,
    carriedDecisionCount: row.records.filter((r) => r.recordType === "decision")
      .length,
  });

  const records = row.records.map((r) =>
    carryOverRecordSchema.parse({
      id: r.id,
      sourceReportId: row.sourceReportId,
      targetReportId: row.targetReportId,
      sourceItemId: r.sourceItemId,
      targetItemId: r.targetItemId,
      sourceDecisionId: r.sourceDecisionId,
      targetDecisionId: r.targetDecisionId,
      status: "completed",
      carriedAt: r.createdAt,
    }),
  );

  return { execution, records };
}

// Re-check editability inside the txn; concurrent winner → resolve, don't insert phantom.
export async function writeCarryOver(
  tx: Prisma.TransactionClient,
  execution: CarryOverExecution,
  records: CarryOverRecord[],
  targetSections: ReportSectionReadModel[],
): Promise<CarryOverResult> {
  await assertTargetEditable(tx, execution.targetReportId);

  const existing = await tx.carryOverExecution.findFirst({
    where: {
      sourceReportId: execution.sourceReportId,
      targetReportId: execution.targetReportId,
    },
  });

  const primaryTargetSection = requirePrimaryTargetSection(targetSections);
  const result = existing
    ? await resolveExistingExecution(tx, existing, primaryTargetSection)
    : await createNewExecution(tx, execution, records, primaryTargetSection);

  // Persist carried rows for EVERY target section on both branches — the
  // inserts are idempotent (skipDuplicates + upstream lineage filtering), so
  // re-running them for an already-recorded execution duplicates nothing.
  for (const targetSection of targetSections) {
    await persistCarriedRowsForSection(tx, targetSection);
  }

  return result;
}

// FOR UPDATE on Report closes the race with concurrent publish/archive.
async function assertTargetEditable(
  tx: Prisma.TransactionClient,
  targetReportId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<
    { periodStatus: "open" | "published" | "reopened"; archived: boolean }[]
  >`SELECT "periodStatus", "archived" FROM "Report" WHERE "id" = ${targetReportId} FOR UPDATE`;
  const state = rows.at(0);
  if (state === undefined || !isTargetEditable(state)) {
    throw new CarryOverConflictError(
      "Carry-over target period is no longer editable.",
    );
  }
}

// Concurrent loser: return the winner's recorded rows, not the caller's phantom ids.
async function resolveExistingExecution(
  tx: Prisma.TransactionClient,
  existing: PrismaCarryOverExecutionRow,
  targetSection: ReportSectionReadModel,
): Promise<CarryOverResult> {
  const records = await tx.carryOverRecord.findMany({
    where: { executionId: existing.id },
  });
  const mapped = mapPrismaToExecution({ ...existing, records });
  return {
    execution: mapped.execution,
    records: mapped.records,
    targetSection,
  };
}

async function createNewExecution(
  tx: Prisma.TransactionClient,
  execution: CarryOverExecution,
  records: CarryOverRecord[],
  targetSection: ReportSectionReadModel,
): Promise<CarryOverResult> {
  await tx.carryOverExecution.create({
    data: {
      id: execution.id,
      sourceReportId: execution.sourceReportId,
      targetReportId: execution.targetReportId,
      dedupeKey: execution.dedupeKey,
      status: execution.status,
    },
  });

  if (records.length > 0) {
    await tx.carryOverRecord.createMany({
      data: records.map((r) => ({
        id: r.id,
        executionId: execution.id,
        sourceItemId: r.sourceItemId,
        sourceDecisionId: r.sourceDecisionId,
        targetItemId: r.targetItemId,
        targetDecisionId: r.targetDecisionId,
        recordType: r.targetItemId ? "item" : "decision",
      })),
    });
  }

  return { execution, records, targetSection };
}
