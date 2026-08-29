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
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import {
  CarryOverConflictError,
  type CarryOverResult,
  isTargetEditable,
} from "./carry-over.service";
import {
  mergePlannedCarriedRows,
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

  const currentTargetSections = await lockAndReadTargetSections(
    tx,
    execution.targetReportId,
  );
  const writableTargetSections = currentTargetSections.map((current) =>
    mergePlannedCarriedRows(
      current,
      targetSections.find(
        (planned) => planned.reportSectionId === current.reportSectionId,
      ),
    ),
  );
  const primaryTargetSection = requirePrimaryTargetSection(
    writableTargetSections,
  );

  if (
    writableTargetSections.some((section) => section.status === "submitted")
  ) {
    throw new CarryOverConflictError(
      "Carry-over cannot overwrite a submitted target section.",
    );
  }

  const existing = await tx.carryOverExecution.findFirst({
    where: {
      sourceReportId: execution.sourceReportId,
      targetReportId: execution.targetReportId,
    },
  });

  // A committed winner already persisted its rows; replaying it must stay a
  // read-only resolution, never re-execute the carried-row writes.
  if (existing) {
    return resolveExistingExecution(tx, existing, primaryTargetSection);
  }

  const result = await createNewExecution(
    tx,
    execution,
    records,
    primaryTargetSection,
  );

  // Persist carried rows for EVERY target section on the create path — the
  // inserts are idempotent (skipDuplicates + upstream lineage filtering).
  for (const targetSection of writableTargetSections) {
    await persistCarriedRowsForSection(tx, targetSection);
  }

  return result;
}

async function lockAndReadTargetSections(
  tx: Prisma.TransactionClient,
  targetReportId: string,
): Promise<ReportSectionReadModel[]> {
  const lockedRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "ReportSection"
    WHERE "reportId" = ${targetReportId}
    ORDER BY "id"
    FOR UPDATE`;
  if (lockedRows.length === 0) return [];

  const rows = await tx.reportSection.findMany({
    where: {
      reportId: targetReportId,
      id: { in: lockedRows.map((row) => row.id) },
    },
    include: reportSectionFullInclude,
    relationLoadStrategy: "join",
  });
  const byId = new Map(
    rows.map((row) => [row.id, mapPrismaToReportSection(row)]),
  );
  return lockedRows.flatMap((row) => {
    const section = byId.get(row.id);
    return section === undefined ? [] : [section];
  });
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
