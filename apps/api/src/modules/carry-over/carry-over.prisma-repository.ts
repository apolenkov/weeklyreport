import {
  type CarryOverExecution,
  type CarryOverRecord,
  carryOverExecutionSchema,
  carryOverRecordSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/report-sections.prisma-repository";
import type {
  CarryOverRepository,
  CarryOverResult,
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
  records: Array<{
    id: string;
    executionId: string;
    sourceItemId: string | null;
    sourceDecisionId: string | null;
    targetItemId: string | null;
    targetDecisionId: string | null;
    recordType: string;
    createdAt: Date;
  }>;
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
    const row = await this.prisma.carryOverExecution.findUnique({
      where: { dedupeKey },
      include: { records: true },
    });

    if (!row) {
      return null;
    }

    const { execution } = mapPrismaToExecution(row);
    return execution;
  }

  async getSourceSections(
    sourceReportId: string,
  ): Promise<ReportSectionReadModel[]> {
    const rows = await this.prisma.reportSection.findMany({
      where: { reportId: sourceReportId },
      include: reportSectionFullInclude,
    });

    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    return rows.map((row) => mapPrismaToReportSection(row as any));
  }

  async getTargetSections(
    targetReportId: string,
  ): Promise<ReportSectionReadModel[]> {
    const rows = await this.prisma.reportSection.findMany({
      where: { reportId: targetReportId },
      include: reportSectionFullInclude,
    });

    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    return rows.map((row) => mapPrismaToReportSection(row as any));
  }

  async saveCarryOver(
    execution: CarryOverExecution,
    records: CarryOverRecord[],
    targetSection: ReportSectionReadModel,
  ): Promise<CarryOverResult> {
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

        // Upsert carried-over items into target section
        const carriedItems = targetSection.items.filter((i) => i.carriedOver);
        if (carriedItems.length > 0) {
          await tx.item.createMany({
            data: carriedItems.map((i) => ({
              id: i.id ?? undefined,
              reportSectionId: targetSection.reportSectionId,
              projectId: i.projectId,
              type: i.type,
              text: i.text,
              tag: i.tag,
              workflowStatus: i.workflowStatus,
              carriedOver: true,
              completed: i.completed ?? null,
            })),
            skipDuplicates: true,
          });
        }

        // Upsert carried-over decisions into target section
        const carriedDecisions = targetSection.decisions.filter(
          (d) => !d.resolvedAt,
        );
        const existingDecisionIds = (
          await tx.decision.findMany({
            where: { reportSectionId: targetSection.reportSectionId },
            select: { id: true },
          })
        ).map((d) => d.id);

        const newDecisions = carriedDecisions.filter(
          (d) => d.id && !existingDecisionIds.includes(d.id),
        );

        const decisionsWithProduct = newDecisions.filter((d) => !!d.productId);
        if (decisionsWithProduct.length > 0) {
          await tx.decision.createMany({
            data: decisionsWithProduct.map((d) => ({
              id: d.id ?? undefined,
              reportSectionId: targetSection.reportSectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ?? null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ?? null,
              stageName: d.stageIds?.join(", ") ?? null,
              productId: d.productId as string,
            })),
          });
        }
      },
      { timeout: 15000 },
    );

    return { execution, records, targetSection };
  }
}
