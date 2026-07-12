import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type {
  CarryOverExecution as PrismaCarryOverExecutionRow,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import {
  CarryOverConflictError,
  type CarryOverRepository,
  type CarryOverResult,
  isTargetEditable,
  type TargetReportState,
} from "./carry-over.service";
import { persistCarriedRowsForSection } from "./carry-over-row-writes";

/**
 * Maps a Prisma CarryOverExecution row (+ records) to the domain CarryOverExecution shape.
 * Bridges Prisma model fields to Zod schema fields.
 */
function mapPrismaToExecution(row: {
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

@Injectable()
export class CarryOverPrismaRepository implements CarryOverRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<CarryOverExecution | null> {
    const result = await this.readExecutionByDedupeKey(dedupeKey);
    return result?.execution ?? null;
  }

  private async readExecutionByDedupeKey(dedupeKey: string): Promise<{
    execution: CarryOverExecution;
    records: CarryOverRecord[];
  } | null> {
    const row = await this.prisma.carryOverExecution.findUnique({
      where: { dedupeKey },
      include: { records: true },
    });

    return row ? mapPrismaToExecution(row) : null;
  }

  /**
   * The "prior period" the automatic carry-over reads from: the latest report
   * whose periodEnd is on/before the target's periodStart. Deterministic
   * total order (periodEnd, createdAt, id — all desc) so two candidates
   * sharing a boundary never flip between reads.
   */
  async findPreviousReportId(targetReportId: string): Promise<string | null> {
    const target = await this.prisma.report.findUnique({
      where: { id: targetReportId },
      select: { periodStart: true },
    });
    if (!target) return null;
    const previous = await this.prisma.report.findFirst({
      where: {
        id: { not: targetReportId },
        periodEnd: { lte: target.periodStart },
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    return previous?.id ?? null;
  }

  async getTargetReportState(
    targetReportId: string,
  ): Promise<TargetReportState | null> {
    const row = await this.prisma.report.findUnique({
      where: { id: targetReportId },
      select: { periodStatus: true, archived: true },
    });

    return row
      ? { periodStatus: row.periodStatus, archived: row.archived }
      : null;
  }

  async getSourceSections(
    sourceReportId: string,
  ): Promise<ReportSectionReadModel[]> {
    const rows = await this.prisma.reportSection.findMany({
      where: { reportId: sourceReportId },
      include: reportSectionFullInclude,
    });

    return rows.map((row) => mapPrismaToReportSection(row));
  }

  async getTargetSections(
    targetReportId: string,
  ): Promise<ReportSectionReadModel[]> {
    const rows = await this.prisma.reportSection.findMany({
      where: { reportId: targetReportId },
      include: reportSectionFullInclude,
    });

    return rows.map((row) => mapPrismaToReportSection(row));
  }

  async saveCarryOver(
    execution: CarryOverExecution,
    records: CarryOverRecord[],
    targetSections: ReportSectionReadModel[],
  ): Promise<CarryOverResult> {
    try {
      return await this.prisma.$transaction(
        (tx) => writeCarryOver(tx, execution, records, targetSections),
        { timeout: 15_000 },
      );
    } catch (error) {
      // Dedupe race: two carry-overs for the same source/target both pass the
      // app-level existing-execution check, then the second insert hits the
      // `dedupeKey` unique constraint (P2002). Resolve to the already-recorded
      // execution (idempotent success) rather than surfacing a raw 500; only if
      // it cannot be re-read does this become a distinct conflict. The
      // in-transaction editability re-check throws CarryOverConflictError, a
      // distinct type, so it propagates past this branch unchanged.
      if (isUniqueViolation(error)) {
        return this.resolveDedupeRace(execution, targetSections);
      }
      throw error;
    }
  }

  private async resolveDedupeRace(
    execution: CarryOverExecution,
    targetSections: ReportSectionReadModel[],
  ): Promise<CarryOverResult> {
    const recorded = await this.readExecutionByDedupeKey(execution.dedupeKey);
    if (recorded) {
      return {
        execution: recorded.execution,
        records: recorded.records,
        targetSection: targetSections[0],
      };
    }
    throw new CarryOverConflictError(
      "Carry-over is already in progress for this source and target report.",
    );
  }
}

/**
 * The write transaction. Re-validates target editability against freshly-read
 * period state (closing the window between the service's pre-transaction check
 * and this commit), then either records a new execution or, when a concurrent
 * winner already committed one for this source/target pair, resolves to that
 * winner's execution and records instead of inserting against an id that was
 * never committed.
 */
async function writeCarryOver(
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

  const result = existing
    ? await resolveExistingExecution(tx, existing, targetSections[0])
    : await createNewExecution(tx, execution, records, targetSections[0]);

  // Persist carried rows for EVERY target section on both branches — the
  // inserts are idempotent (skipDuplicates + upstream lineage filtering), so
  // re-running them for an already-recorded execution duplicates nothing.
  for (const targetSection of targetSections) {
    await persistCarriedRowsForSection(tx, targetSection);
  }

  return result;
}

/**
 * Locks the target report row (SELECT ... FOR UPDATE, house pattern from the
 * section-save transaction) and rejects a no-longer-editable period. The lock
 * is what closes the window: a concurrent publish/archive writes this same
 * row, so it either committed first (this read then aborts before any
 * carry-over write) or blocks until this transaction commits.
 */
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

/**
 * Loser of a concurrent race: the winner's execution already holds this
 * source/target pair, keyed on an id the caller never committed. Return the
 * winner's own recorded rows rather than inserting the caller's phantom ones.
 */
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
        recordType: r.sourceItemId ? "item" : "decision",
      })),
    });
  }

  return { execution, records, targetSection };
}
