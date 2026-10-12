import {
  type CarryOverExecution as PrismaCarryOverExecutionRow,
  Prisma,
} from "@prisma/client";
import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@weeklyreport/shared";

import { lockCurrentEditableReport } from "../../lib/report-lifecycle.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import {
  CarryOverConflictError,
  type CarryOverResult,
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

// Persist carried rows for EVERY target section on the create path — the
// inserts are idempotent (skipDuplicates + upstream lineage filtering).
async function persistCarriedRowsForAllSections(
  tx: Prisma.TransactionClient,
  sections: readonly ReportSectionReadModel[],
): Promise<void> {
  for (const targetSection of sections) {
    const { insertedItems, insertedDecisions } =
      await persistCarriedRowsForSection(tx, targetSection);
    if (insertedItems + insertedDecisions > 0) {
      await tx.reportSection.update({
        where: { id: targetSection.reportSectionId },
        data: { version: { increment: 1 } },
      });
    }
  }
}

// Re-check editability inside the txn; concurrent winner → resolve, don't insert phantom.
export async function writeCarryOver(
  tx: Prisma.TransactionClient,
  execution: CarryOverExecution,
  records: CarryOverRecord[],
  targetSections: ReportSectionReadModel[],
): Promise<CarryOverResult> {
  const targetGate = await lockCurrentEditableReport(tx, {
    reportId: execution.targetReportId,
  });
  if (targetGate.kind !== "editable") {
    throw new CarryOverConflictError(
      "Carry-over target period is no longer editable.",
    );
  }

  const currentTargetSections = await lockAndReadTargetSections(
    tx,
    execution.targetReportId,
    targetSections.map((section) => section.reportSectionId),
  );
  const primaryCurrentTargetSection = requirePrimaryTargetSection(
    currentTargetSections,
  );

  if (currentTargetSections.some((section) => section.status === "submitted")) {
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
    return resolveExistingExecution(tx, existing, primaryCurrentTargetSection);
  }

  const writableTargetSections = currentTargetSections.map((current) =>
    mergePlannedCarriedRows(
      current,
      targetSections.find(
        (planned) => planned.reportSectionId === current.reportSectionId,
      ),
      records,
    ),
  );

  await persistCarriedRowsForAllSections(tx, writableTargetSections);

  const persistedTargetSections = await readTargetSections(
    tx,
    execution.targetReportId,
    currentTargetSections.map((section) => section.reportSectionId),
  );
  const persistedRecords = recordsForNewPersistedRows(
    records,
    currentTargetSections,
    persistedTargetSections,
  );
  const persistedExecution = carryOverExecutionSchema.parse({
    ...execution,
    carriedItemCount: persistedRecords.filter(
      (record) => record.targetItemId !== null,
    ).length,
    carriedDecisionCount: persistedRecords.filter(
      (record) => record.targetDecisionId !== null,
    ).length,
  });
  // Execution metadata follows the verified row readback. It remains atomic:
  // any metadata failure rolls back the earlier row and version writes.
  await createNewExecution(tx, persistedExecution, persistedRecords);
  return {
    execution: persistedExecution,
    records: persistedRecords,
    targetSection: requirePrimaryTargetSection(persistedTargetSections),
  };
}

function recordsForNewPersistedRows(
  records: readonly CarryOverRecord[],
  before: readonly ReportSectionReadModel[],
  after: readonly ReportSectionReadModel[],
): CarryOverRecord[] {
  const previousItemIds = new Set(
    before.flatMap((section) =>
      section.items.flatMap((item) => (item.id === undefined ? [] : [item.id])),
    ),
  );
  const previousDecisionIds = new Set(
    before.flatMap((section) =>
      section.decisions.flatMap((decision) =>
        decision.id === undefined ? [] : [decision.id],
      ),
    ),
  );
  const newItemIds = new Set(
    after.flatMap((section) =>
      section.items.flatMap((item) =>
        item.id === undefined || previousItemIds.has(item.id) ? [] : [item.id],
      ),
    ),
  );
  const newDecisionIds = new Set(
    after.flatMap((section) =>
      section.decisions.flatMap((decision) =>
        decision.id === undefined || previousDecisionIds.has(decision.id)
          ? []
          : [decision.id],
      ),
    ),
  );

  return records.filter((record) =>
    record.targetItemId !== null
      ? newItemIds.has(record.targetItemId)
      : record.targetDecisionId !== null &&
        newDecisionIds.has(record.targetDecisionId),
  );
}

async function lockAndReadTargetSections(
  tx: Prisma.TransactionClient,
  targetReportId: string,
  targetSectionIds: readonly string[],
): Promise<ReportSectionReadModel[]> {
  if (targetSectionIds.length === 0) return [];
  const lockedRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "ReportSection"
    WHERE "reportId" = ${targetReportId}
      AND "id" IN (${Prisma.join(targetSectionIds)})
    ORDER BY "id"
    FOR UPDATE`;
  if (lockedRows.length === 0) return [];

  return readTargetSections(
    tx,
    targetReportId,
    lockedRows.map((row) => row.id),
  );
}

async function readTargetSections(
  tx: Prisma.TransactionClient,
  targetReportId: string,
  targetSectionIds: readonly string[],
): Promise<ReportSectionReadModel[]> {
  if (targetSectionIds.length === 0) return [];
  const rows = await tx.reportSection.findMany({
    where: {
      reportId: targetReportId,
      id: { in: [...targetSectionIds] },
    },
    include: reportSectionFullInclude,
    relationLoadStrategy: "join",
  });
  const byId = new Map(
    rows.map((row) => [row.id, mapPrismaToReportSection(row)]),
  );
  return targetSectionIds.flatMap((sectionId) => {
    const section = byId.get(sectionId);
    return section === undefined ? [] : [section];
  });
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
): Promise<void> {
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
}
