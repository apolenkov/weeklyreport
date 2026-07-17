import {
  type ReportSectionReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  buildPortfolioProductsFromSnapshotSections,
  filterSnapshotSections,
  parsePublishedSnapshot,
} from "../published-report-snapshot.js";
import { buildEscalationsFromReadSections } from "../report-escalations.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import { isDesignatedReviewer } from "../review/index.js";
import { queryCompiledHistory } from "./compiled-history.prisma-query.js";
import {
  computeCrossGroupSignal,
  computeCrossGroupSignalFromSnapshotProjects,
} from "./cross-group-signal.js";
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
  buildPortfolioOverview,
  scopeWhere,
} from "./weekly-report-portfolio.js";

@Injectable()
export class WeeklyReportPrismaRepository implements WeeklyReportRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    const sectionScope = scopeWhere(session, "reportSection");
    const userScope = scopeWhere(session, "user");
    // The weekly-report portfolio
    // is the only `'project'`-target scope-filter consumer in the api. Its
    // semantics are "what products does this group currently own?" — that
    // matches the explicit GroupProduct M:M edge,
    // not the implicit `lead.reportingGroupId` derivation. Opt this site
    // into the explicit edge so a product attached to two groups via the
    // join surfaces in both heads' weekly reports, and a lead rotation
    // does not silently drop a product from its group's portfolio.
    //
    // Lead's write path (saveDraft / submit) does not flow through this
    // helper — it goes through `auth.routes.ts` with `leadId: userId`
    // directly — so flipping this site only affects READ visibility.
    const projectScope = scopeWhere(session, "project", {
      useExplicitGroupProducts: true,
    });

    const report = await this.prisma.report.findUnique({
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

    if (!report) {
      return null;
    }

    // Parse the frozen snapshot before the reads below: it decides whether the
    // published render path runs, and that path reads nothing from the live
    // `projects` rows — so the projects query can skip the heavy
    // `stageAssignments` join whenever the snapshot will render. A published
    // report whose snapshot is null/unparseable falls through to the live
    // path, hence the join is keyed on the actual render condition, not on
    // `periodStatus` alone.
    const snapshot = parsePublishedSnapshot(report.publishedSnapshot);
    const useSnapshot =
      snapshot !== null && report.periodStatus === "published";

    // Three independent reads, dispatched concurrently (the count needs only
    // `report.deadline`, already in hand). The live project portfolio is
    // skipped OUTRIGHT on the snapshot render path — that branch reads every
    // signal from the frozen snapshot and never touches these rows.
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
      // canSendReminder is driven by ReminderPolicy validity windows, not by
      // per-report ReminderRule presence. The UI signal `hasActiveReminderRule`
      // keeps its wire-format name to avoid a cross-cutting rename, but its
      // semantics are: "∃ at least one active ReminderPolicy whose validity
      // window covers this Report.deadline". The policy-driven scheduler
      // materialises ReminderRule rows lazily, so gating on per-period rule
      // existence would mis-match it.
      this.prisma.reminderPolicy.count({
        where: {
          active: true,
          validFrom: { lte: report.deadline },
          OR: [{ validUntil: null }, { validUntil: { gte: report.deadline } }],
        },
      }),
    ]);

    const submissionCount = report.sections.filter(
      (s) => s.status === "submitted",
    ).length;

    const totalLeads = leadUsers.length;
    // The brand label is intentionally absent from the weekly read model —
    // frontends read `auth.me.organization.fullName`, so this API path does
    // not touch `AppSettings` here.

    if (snapshot && report.periodStatus === "published") {
      const scopedSnapshot = filterSnapshotSections(
        snapshot,
        sectionScope
          ? new Set(report.sections.map((section) => section.id))
          : undefined,
      );
      const leadSections = scopedSnapshot.sections;
      const snapshotSubmissionCount = leadSections.filter(
        (section) => section.status === "submitted",
      ).length;

      // On a published period the read model is built from the frozen
      // snapshot, not from the live project rows — so the audit signal is
      // derived from each surfaced product's owner group as frozen INTO the
      // snapshot, never a live re-query. A product delivered via the snapshot
      // but since archived, or whose GroupProduct edge was since removed, would
      // drop out of the live query yet still reach the caller; sourcing the
      // signal from the snapshot keeps it named. The live `projects` query is
      // unused on this branch.
      const crossGroup = computeCrossGroupSignalFromSnapshotProjects(
        session,
        leadSections.flatMap((section) => section.projects),
      );

      return {
        readModel: weeklyReportReadModelSchema.parse({
          reportId: report.id,
          periodStart: scopedSnapshot.periodStart,
          periodEnd: scopedSnapshot.periodEnd,
          deadline: scopedSnapshot.deadline,
          periodStatus: report.periodStatus,
          weekLabel: report.weekLabel,
          submissionCount: snapshotSubmissionCount,
          totalLeads,
          hasActiveReminderRule: activePolicyCount > 0,
          portfolioOverview:
            buildPortfolioProductsFromSnapshotSections(leadSections),
          leadSections,
          escalations: buildEscalationsFromReadSections(leadSections),
        }),
        crossGroup,
      };
    }

    // D1: compute the cross-group signal for the router to emit
    // scopeAccessed. Admin sessions produce no scope filter and are never
    // cross-group callers; non-session paths also skip. On the live (non-
    // published) path every fetched project row surfaces in the read model,
    // so the signal is computed from the full scoped project list.
    const crossGroup = computeCrossGroupSignal(session, projects);

    // review-acknowledgement: stamp each live section with its author's group
    // and whether THIS caller is a designated reviewer for it. Batched — one
    // viewerGroupAccess query over the distinct groups (never N per section).
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
    const leadSections = mappedSections.map((section) => {
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

    // fix-published-empty-stage-risk-floor: source product-card statuses from
    // the floored read-model sections (`leadSections`), not the raw
    // `report.sections[].projectStatuses`. The mapper already folds the
    // author's own covering risks into each product's `trafficLight`
    // (report-sections mapper line 347), so an owned stage with status:null
    // covered by a blocked/at-risk own risk reads red/yellow here too — the
    // card no longer disagrees with this same payload's floored leadSections
    // and escalations. Card membership stays driven by the scoped `projects`
    // list (a group-owned product no lead has touched keeps its null card).
    const portfolioOverview = buildPortfolioOverview(projects, leadSections);

    // Map the live Prisma rows to the read model, then run the SAME builder
    // the published-snapshot path uses, so the Blocked-&-At-Risk panel emits
    // byte-identical stage/product output on both surfaces (W7/W8 parity).
    const escalations = buildEscalationsFromReadSections(leadSections);

    return {
      readModel: weeklyReportReadModelSchema.parse({
        reportId: report.id,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        deadline: report.deadline,
        periodStatus: report.periodStatus,
        weekLabel: report.weekLabel,
        submissionCount,
        totalLeads,
        hasActiveReminderRule: activePolicyCount > 0,
        portfolioOverview,
        leadSections,
        escalations,
      }),
      crossGroup,
    };
  }

  /**
   * review-acknowledgement: the subset of `distinctGroupIds` for which a VIEWER
   * caller carries `canReview = true` on their `ViewerGroupAccess` row. Head and
   * admin designation is decided by `isDesignatedReviewer` without a query, so
   * this only fires for the viewer role — one batched read over the report's
   * distinct groups, never one query per section.
   */
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
