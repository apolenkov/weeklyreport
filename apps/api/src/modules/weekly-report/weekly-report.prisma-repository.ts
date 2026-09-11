import type { UserSession } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { guardGroupScope } from "../../lib/group-scope.js";
import {
  publishedReportScopeWhere,
  reportSectionFullInclude,
  requirePublishedSnapshot,
} from "../report-sections/index.js";
import { queryCompiledHistory } from "./compiled-history.prisma-query.js";
import {
  queryLatestPublishedVisibleId,
  queryVisibleReportId,
} from "./latest-for-viewer.prisma-query.js";
import {
  queryCurrentEditableId,
  queryLatestPublishedNonArchivedId,
} from "./report-lifecycle-ids.prisma-query.js";
import type {
  WeeklyReportRepository,
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";
import { buildLiveReportResult } from "./weekly-report-live-read.js";
import {
  buildSnapshotResult,
  deriveScopeFilters,
  type WeeklyReportMetadata,
  type WeeklyReportRow,
} from "./weekly-report-read-model.js";

@Injectable()
export class WeeklyReportPrismaRepository implements WeeklyReportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getCurrentEditableId(): Promise<string | null> {
    return queryCurrentEditableId(this.prisma);
  }

  getCurrentEditableIdForSession(session: UserSession): Promise<string | null> {
    guardGroupScope(session);
    return queryCurrentEditableId(this.prisma);
  }

  getLatestPublishedNonArchivedId(): Promise<string | null> {
    return queryLatestPublishedNonArchivedId(this.prisma);
  }

  async getWeeklyReport(
    reportId: string,
    session: UserSession,
  ): Promise<WeeklyReportRepositoryResult | null> {
    return this.prisma.$transaction(
      (tx) => this.getWeeklyReportInTransaction(reportId, session, tx),
      { isolationLevel: "RepeatableRead" },
    );
  }

  private async getWeeklyReportInTransaction(
    reportId: string,
    session: UserSession,
    db: PrismaService | Prisma.TransactionClient,
  ): Promise<WeeklyReportRepositoryResult | null> {
    const { sectionScope } = deriveScopeFilters(session);

    const metadata = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!metadata) {
      return null;
    }

    if (metadata.periodStatus === "published") {
      // Closed reports are admitted by the frozen projection before their
      // envelope is exposed. This prevents an unauthorized id from becoming
      // an observable empty/active report; admin remains the explicit
      // sectionless-report exception through the shared scope policy.
      if (session.role !== "admin") {
        const admitted = await db.report.findFirst({
          where: {
            id: reportId,
            ...publishedReportScopeWhere(session),
          },
          select: { id: true },
        });
        if (!admitted) return null;
      }
      return this.buildPublishedResult(metadata, session);
    }

    // Only editable/reopened paths load mutable sections. Re-read lifecycle
    // with the section graph; any transition observed after the initial
    // metadata read is a stale request and must be retried by the caller.
    const report = await this.loadReportWithSections(
      db,
      reportId,
      sectionScope,
    );
    if (!report) return null;

    if (report.periodStatus === "published") {
      // Keep the read fail-closed even when the viewer would be admitted by
      // the frozen projection. Returning a snapshot here could mix two
      // lifecycle observations into one response; the next request resolves
      // the published report through its normal admission path.
      await this.isPublishedReportAdmitted(db, reportId, session);
      return null;
    }

    return buildLiveReportResult(db, report, session);
  }

  private buildPublishedResult(
    report: WeeklyReportMetadata,
    session: UserSession,
  ): WeeklyReportRepositoryResult {
    // Validate and scope solely from the immutable payload. In particular,
    // restored publications have no requirement to recreate ReportSection.
    const snapshot = requirePublishedSnapshot(
      report.publishedSnapshot,
      report.id,
    );
    return buildSnapshotResult(report, snapshot, session);
  }

  private async isPublishedReportAdmitted(
    db: PrismaService | Prisma.TransactionClient,
    reportId: string,
    session: UserSession,
  ): Promise<boolean> {
    if (session.role === "admin") return true;
    const admitted = await db.report.findFirst({
      where: {
        id: reportId,
        ...publishedReportScopeWhere(session),
      },
      select: { id: true },
    });
    return admitted !== null;
  }

  private loadReportWithSections(
    db: PrismaService | Prisma.TransactionClient,
    reportId: string,
    sectionScope: Record<string, unknown> | undefined,
  ): Promise<WeeklyReportRow | null> {
    return db.report.findUnique({
      where: { id: reportId },
      include: {
        sections: {
          ...(sectionScope ? { where: sectionScope } : {}),
          include: reportSectionFullInclude,
          // Same deterministic order as the frozen-snapshot include: the
          // live/draft render branch must not serve raw heap order.
          orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
        },
      },
    });
  }

  getCompiledHistory(
    session: WeeklyReportScopeSession,
    includeArchive: boolean,
  ): ReturnType<typeof queryCompiledHistory> {
    guardGroupScope(session);
    return queryCompiledHistory(this.prisma, session, includeArchive);
  }

  getVisibleReportId(reportId: string, session: UserSession) {
    guardGroupScope(session);
    return queryVisibleReportId(this.prisma, reportId, session);
  }

  getLatestPublishedVisibleId(session: UserSession) {
    guardGroupScope(session);
    return queryLatestPublishedVisibleId(this.prisma, session);
  }
}
