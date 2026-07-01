import {
  type CarryOverExecution,
  carryOverExecutionSchema,
  type CarryOverRecord,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  mapPrismaToReportSection,
  type PrismaReportSectionWithRelations,
  reportSectionFullInclude,
} from "../report-sections/report-sections.prisma-repository";
import {
  CarryOverConflictError,
  type CarryOverRepository,
  type CarryOverResult,
  type TargetReportState,
} from "./carry-over.service";

/**
 * Maps a Prisma CarryOverExecution row (+ records) to the domain CarryOverExecution shape.
 * Bridges Prisma model fields to Zod schema fields (REPO-09).
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

    return rows.map((row) =>
      mapPrismaToReportSection(
        row as unknown as PrismaReportSectionWithRelations,
      ),
    );
  }

  async getTargetSections(
    targetReportId: string,
  ): Promise<ReportSectionReadModel[]> {
    const rows = await this.prisma.reportSection.findMany({
      where: { reportId: targetReportId },
      include: reportSectionFullInclude,
    });

    return rows.map((row) =>
      mapPrismaToReportSection(
        row as unknown as PrismaReportSectionWithRelations,
      ),
    );
  }

  async saveCarryOver(
    execution: CarryOverExecution,
    records: CarryOverRecord[],
    targetSections: ReportSectionReadModel[],
  ): Promise<CarryOverResult> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Idempotency guard: check for existing execution before creating
          const existing = await tx.carryOverExecution.findFirst({
            where: {
              sourceReportId: execution.sourceReportId,
              targetReportId: execution.targetReportId,
            },
          });

          if (!existing) {
            await tx.carryOverExecution.create({
              data: {
                id: execution.id,
                sourceReportId: execution.sourceReportId,
                targetReportId: execution.targetReportId,
                dedupeKey: execution.dedupeKey,
                status: execution.status,
              },
            });
          }

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

          // Persist carried rows for EVERY target section, not just the first —
          // the service merges each matched lead's carried items/decisions into
          // its own section, all written in this single transaction.
          for (const targetSection of targetSections) {
            const carriedItems = targetSection.items.filter(
              (i) => i.carriedOver,
            );
            if (carriedItems.length > 0) {
              await tx.item.createMany({
                data: carriedItems.map((i) => ({
                  id: i.id ?? undefined,
                  // Carry the source record's durable lineage key onto the clone
                  // (it rides the `...item` spread in cloneCarriedItem) so the
                  // carried позиция shares one identity with its origin. A fresh
                  // PK `id` still comes from the clone above.
                  stableId: i.stableId,
                  reportSectionId: targetSection.reportSectionId,
                  projectId: i.projectId,
                  type: i.type,
                  text: i.text,
                  tag: i.tag,
                  workflowStatus: i.workflowStatus,
                  carriedOver: true,
                  completed: i.completed ?? null,
                  priorityRank: i.priorityRank ?? null,
                  stageNames: i.stageIds ?? [],
                })),
                skipDuplicates: true,
              });
            }

            const carriedDecisions = targetSection.decisions.filter(
              (d) => !d.resolvedAt,
            );
            const existingDecisionIds = new Set(
              (
                await tx.decision.findMany({
                  where: { reportSectionId: targetSection.reportSectionId },
                  select: { id: true },
                })
              ).map((d) => d.id),
            );

            const newDecisions = carriedDecisions.filter(
              (d) => d.id && !existingDecisionIds.has(d.id),
            );

            // Decision.productId is a NOT-NULL product FK, so a productless
            // decision cannot persist — skip it here (the service already
            // excludes it from counts/records).
            const decisionsWithProduct = newDecisions.filter(
              (d): d is typeof d & { productId: string } =>
                Boolean(d.productId),
            );
            if (decisionsWithProduct.length > 0) {
              await tx.decision.createMany({
                data: decisionsWithProduct.map((d) => ({
                  id: d.id ?? undefined,
                  // Carry the source decision's durable lineage key onto the
                  // clone (rides the `...decision` spread in
                  // cloneUnresolvedDecision).
                  stableId: d.stableId,
                  reportSectionId: targetSection.reportSectionId,
                  text: d.text,
                  owner: d.owner,
                  deadline: d.deadline ?? null,
                  impact: d.impact,
                  resolvedAt: d.resolvedAt ?? null,
                  stageNames: d.stageIds ?? [],
                  productId: d.productId,
                })),
                // Parity with the item insert above: a carried decision whose
                // lineage already exists in the target section (the new
                // `@@unique([reportSectionId, stableId])`) is skipped, not a
                // P2002 misread as a dedupe-key race. The service also filters
                // such lineages upstream; this is defense-in-depth against a race.
                skipDuplicates: true,
              });
            }
          }
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      // Dedupe race: two carry-overs for the same source/target both pass the
      // app-level existing-execution check, then the second insert hits the
      // `dedupeKey` unique constraint (P2002). Resolve to the already-recorded
      // execution (idempotent success) rather than surfacing a raw 500; only if
      // it cannot be re-read does this become a distinct conflict. No `failed`
      // status is ever written.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const recorded = await this.readExecutionByDedupeKey(
          execution.dedupeKey,
        );
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
      throw error;
    }

    return { execution, records, targetSection: targetSections[0] };
  }
}
