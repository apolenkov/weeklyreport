import {
  type CarryOverExecution,
  type CarryOverRecord,
  type ReportSectionReadModel,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

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
  type TargetReportState,
} from "./carry-over.service";
import {
  mapPrismaToExecution,
  writeCarryOver,
} from "./carry-over.write-transaction";
import { requirePrimaryTargetSection } from "./carry-over-row-writes";

// Multi-section clone can exceed Prisma's default 5s under load.
const CARRY_OVER_TX_TIMEOUT_MS = 15_000;

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

  // Latest report with periodEnd ≤ target.periodStart; total order periodEnd, createdAt, id.
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
    return this.readSectionsByReport(sourceReportId);
  }

  async getTargetSections(
    targetReportId: string,
  ): Promise<ReportSectionReadModel[]> {
    return this.readSectionsByReport(targetReportId);
  }

  private async readSectionsByReport(
    reportId: string,
  ): Promise<ReportSectionReadModel[]> {
    const rows = await this.prisma.reportSection.findMany({
      where: { reportId },
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
        { timeout: CARRY_OVER_TX_TIMEOUT_MS },
      );
    } catch (error) {
      // Concurrent carry hits dedupeKey P2002 → resolve to winner (idempotent).
      // CarryOverConflictError from editability re-check propagates unchanged.
      if (isUniqueViolation(error)) {
        return this.resolveDedupeRace(execution);
      }
      throw error;
    }
  }

  private async resolveDedupeRace(
    execution: CarryOverExecution,
  ): Promise<CarryOverResult> {
    const recorded = await this.readExecutionByDedupeKey(execution.dedupeKey);
    if (recorded) {
      const winnerSections = await this.readSectionsByReport(
        recorded.execution.targetReportId,
      );
      return {
        execution: recorded.execution,
        records: recorded.records,
        targetSection: requirePrimaryTargetSection(winnerSections),
      };
    }
    throw new CarryOverConflictError(
      "Carry-over is already in progress for this source and target report.",
    );
  }
}
