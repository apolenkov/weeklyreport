import { type ReportSectionReadModel } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  mapPrismaToReportSection,
  parsePublishedSnapshot,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import { isDesignatedReviewer } from "../review/index.js";
import { queryCompiledHistory } from "./compiled-history.prisma-query.js";
import { computeCrossGroupSignal } from "./cross-group-signal.js";
import {
  queryLatestPublishedVisibleId,
  queryVisibleReportId,
} from "./latest-for-viewer.prisma-query.js";
import {
  queryActiveReportId,
  queryCurrentEditableId,
  queryLatestPublishedNonArchivedId,
} from "./report-lifecycle-ids.prisma-query.js";
import type {
  WeeklyReportRepository,
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";
import {
  buildLiveResult,
  buildSnapshotResult,
  deriveScopeFilters,
  type WeeklyReportLiveSection,
  type WeeklyReportProjectRow,
  type WeeklyReportRow,
} from "./weekly-report-read-model.js";

@Injectable()
export class WeeklyReportPrismaRepository implements WeeklyReportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getActiveReportId(): Promise<string | null> {
    return queryActiveReportId(this.prisma);
  }

  getCurrentEditableId(): Promise<string | null> {
    return queryCurrentEditableId(this.prisma);
  }

  getLatestPublishedNonArchivedId(): Promise<string | null> {
    return queryLatestPublishedNonArchivedId(this.prisma);
  }

  async getWeeklyReport(
    reportId: string,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportRepositoryResult | null> {
    const { sectionScope, userScope, projectScope } =
      deriveScopeFilters(session);

    const report = await this.loadReportWithSections(reportId, sectionScope);

    if (!report) {
      return null;
    }

    // Parsed before the reads below because it decides whether the published
    // path renders, and that path never touches live `projects` — so the heavy
    // `stageAssignments` join keys on this, not on `periodStatus` alone.
    const snapshot = parsePublishedSnapshot(report.publishedSnapshot);
    const useSnapshot =
      snapshot !== null && report.periodStatus === "published";

    const { leadUsers, projects, activePolicyCount } =
      await this.fetchReportDependencies(
        report,
        useSnapshot,
        userScope,
        projectScope,
      );

    const totalLeads = leadUsers.length;
    // The brand label is intentionally absent from the weekly read model —
    // frontends read `auth.me.organization.fullName`, so this API path does
    // not touch `AppSettings` here.

    // Keeping this `if` (rather than branching on `useSnapshot`) lets TS
    // narrow `snapshot` to non-null inside the block.
    if (snapshot && report.periodStatus === "published") {
      return buildSnapshotResult(
        report,
        snapshot,
        session,
        sectionScope,
        totalLeads,
        activePolicyCount,
      );
    }

    const crossGroup = computeCrossGroupSignal(session, projects);
    const leadSections = await this.buildLiveSections(report, session);
    const submissionCount = report.sections.filter(
      (s) => s.status === "submitted",
    ).length;

    return buildLiveResult(
      report,
      leadSections,
      projects,
      crossGroup,
      submissionCount,
      totalLeads,
      activePolicyCount,
    );
  }

  private loadReportWithSections(
    reportId: string,
    sectionScope: Record<string, unknown> | undefined,
  ): Promise<WeeklyReportRow | null> {
    return this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        sections: {
          ...(sectionScope ? { where: sectionScope } : {}),
          include: reportSectionFullInclude,
          // Same deterministic order as the frozen-snapshot include: the
          // live/draft render branch (and a published row whose snapshot is
          // absent) must not serve raw heap order.
          orderBy: [{ author: { name: "asc" } }, { id: "asc" }],
        },
      },
    });
  }

  private async fetchReportDependencies(
    report: WeeklyReportRow,
    useSnapshot: boolean,
    userScope: Record<string, unknown> | undefined,
    projectScope: Record<string, unknown> | undefined,
  ): Promise<{
    readonly leadUsers: { id: string }[];
    readonly projects: WeeklyReportProjectRow[];
    readonly activePolicyCount: number;
  }> {
    // Three independent reads dispatched concurrently. The live project
    // portfolio is skipped outright on the snapshot render path — that branch
    // reads every signal from the frozen snapshot and never touches these rows.
    const [leadUsers, projects, activePolicyCount] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: "lead", ...userScope },
        select: { id: true },
      }),
      useSnapshot
        ? []
        : this.prisma.project.findMany({
            where: { archived: false, ...projectScope },
            include: {
              lead: { select: { reportingGroupId: true } },
              stageAssignments: true,
            },
          }),
      // The wire name `hasActiveReminderRule` is kept deliberately; it means
      // "an active ReminderPolicy window covers report.deadline" (rules are
      // materialised lazily). No deadline, no window reference — zero, no query.
      report.deadline === null
        ? Promise.resolve(0)
        : this.prisma.reminderPolicy.count({
            where: {
              active: true,
              validFrom: { lte: report.deadline },
              OR: [
                { validUntil: null },
                { validUntil: { gte: report.deadline } },
              ],
            },
          }),
    ]);

    return { leadUsers, projects, activePolicyCount };
  }

  private async buildLiveSections(
    report: WeeklyReportRow,
    session: WeeklyReportScopeSession | undefined,
  ): Promise<WeeklyReportLiveSection[]> {
    // Stamp each live section with its author's group and whether THIS caller
    // is a designated reviewer for it. Batched — one viewerGroupAccess query
    // over the distinct groups (never N per section).
    const sectionGroupIds = new Map<string, string | null>(
      report.sections.map((section) => [
        section.id,
        section.author.reportingGroupId,
      ]),
    );
    const distinctGroupIds = [
      ...new Set(
        [...sectionGroupIds.values()].filter(
          (groupId): groupId is string => groupId !== null,
        ),
      ),
    ];
    const viewerReviewGroupIds = await this.resolveViewerReviewGroupIds(
      session,
      distinctGroupIds,
    );

    const mappedSections: ReportSectionReadModel[] = report.sections.map(
      mapPrismaToReportSection,
    );
    return mappedSections.map((section) => {
      const groupId = sectionGroupIds.get(section.reportSectionId) ?? null;
      return {
        ...section,
        groupId,
        canReview:
          groupId !== null && session
            ? isDesignatedReviewer(
                session,
                groupId,
                viewerReviewGroupIds.has(groupId),
              )
            : false,
      };
    });
  }

  // Head/admin designation is decided by `isDesignatedReviewer` without a
  // query, so this only fires for the viewer role — one batched read over the
  // report's distinct groups, never one query per section.
  private async resolveViewerReviewGroupIds(
    session: WeeklyReportScopeSession | undefined,
    distinctGroupIds: readonly string[],
  ): Promise<Set<string>> {
    if (session?.role !== "viewer" || distinctGroupIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.viewerGroupAccess.findMany({
      where: {
        viewerUserId: session.userId,
        groupId: { in: [...distinctGroupIds] },
        canReview: true,
      },
      select: { groupId: true },
    });
    return new Set(rows.map((row) => row.groupId));
  }

  getCompiledHistory(
    session: WeeklyReportScopeSession,
    includeArchive: boolean,
  ): ReturnType<typeof queryCompiledHistory> {
    return queryCompiledHistory(this.prisma, session, includeArchive);
  }

  getVisibleReportId(reportId: string, session: WeeklyReportScopeSession) {
    return queryVisibleReportId(this.prisma, reportId, session);
  }

  getLatestPublishedVisibleId(session: WeeklyReportScopeSession) {
    return queryLatestPublishedVisibleId(this.prisma, session);
  }
}
