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
} from "../report-sections/infrastructure/report-sections.prisma-repository.js";
import { isDesignatedReviewer } from "../review/domain/review-authz.js";
import { computeCrossGroupSignal } from "./cross-group-signal.js";
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

  async getActiveReportId(): Promise<string | null> {
    // Exclude scheduled-future periods: their periodStatus defaults to "open"
    // (the PeriodStatus enum has no "scheduled" value), so a future period
    // would otherwise win the periodStart-desc ordering and be mis-picked as
    // the current period. Requiring periodStart <= now returns the most recent
    // open/reopened period that has actually started.
    const editableReport = await this.prisma.report.findFirst({
      where: {
        periodStatus: { in: ["open", "reopened"] },
        periodStart: { lte: new Date() },
      },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });

    if (editableReport) {
      return editableReport.id;
    }

    const publishedReport = await this.prisma.report.findFirst({
      where: { periodStatus: "published" },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });

    return publishedReport?.id ?? null;
  }

  /**
   * viewer-live-status (Decision 0): the single source of truth for the
   * **current editable period** — the newest non-archived `open`/`reopened`
   * report that has actually started (`periodStart <= now`). Deliberately:
   *   - NO published fallback (unlike `getActiveReportId`): the viewer gate
   *     already admits any `published` report via its first clause, so a
   *     fallback here would let the gate's id-equality match a published id and
   *     defeat the `open → published` race rejection.
   *   - `archived: false`: the admin archive path does not force `periodStatus`,
   *     so an archived row can still read `open`; a `Current period` is
   *     non-archived (CONTEXT.md), and excluding archived rows keeps an
   *     archived-open period from being mistaken for the current one.
   *
   * Determinism (Decision 3): the period-creation lock is a separate change, so
   * two concurrent editable periods can share the same `periodStart`. A
   * `periodStart desc` sort alone leaves that tie to the DB's arbitrary row
   * order — and because the gate and the `latestForViewer` resolver call this
   * helper SEPARATELY, a nondeterministic tie could let them pick DIFFERENT
   * periods (the resolver targets one, the gate authorizes the other → the
   * viewer's own Status entry 404s). The secondary `id desc` key is a total,
   * stable order over the unique primary key, so every call resolves the same
   * id for the same data.
   */
  async getCurrentEditableId(): Promise<string | null> {
    const editableReport = await this.prisma.report.findFirst({
      where: {
        periodStatus: { in: ["open", "reopened"] },
        periodStart: { lte: new Date() },
        archived: false,
      },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      select: { id: true },
    });

    return editableReport?.id ?? null;
  }

  /**
   * viewer-live-status: the newest `published` report id. Used as the viewer's
   * default-report fallback when no current editable period exists, so the
   * resolved default is a period the published-or-current gate accepts. The
   * `id desc` tiebreak keeps the pick deterministic on a shared `periodStart`.
   */
  async getLatestPublishedId(): Promise<string | null> {
    const publishedReport = await this.prisma.report.findFirst({
      where: { periodStatus: "published" },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      select: { id: true },
    });

    return publishedReport?.id ?? null;
  }

  /**
   * The newest non-archived `published` report id. Mirrors
   * `getLatestPublishedId` but adds `archived: false`, so it is the head's
   * `period.reopen` authz target and published-fallback default: a head can
   * reopen the newest non-archived published period even when a newer published
   * row has since been archived (the archived-rejection guard would otherwise
   * block it). The `id desc` tiebreak keeps the pick deterministic on a shared
   * `periodStart`.
   */
  async getLatestPublishedNonArchivedId(): Promise<string | null> {
    const publishedReport = await this.prisma.report.findFirst({
      where: { periodStatus: "published", archived: false },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      select: { id: true },
    });

    return publishedReport?.id ?? null;
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
        },
      },
    });

    if (!report) {
      return null;
    }

    // The lead roster and the project portfolio are independent reads; dispatch
    // them concurrently so the hot report path pays one round-trip, not two.
    const [leadUsers, projects] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: "lead", ...userScope },
        select: { id: true },
      }),
      // D1: add lead.reportingGroupId to detect cross-group products.
      // The thin extra select adds one column to an already-fetched row —
      // no extra round-trip.
      this.prisma.project.findMany({
        where: { archived: false, ...projectScope },
        include: {
          stageAssignments: true,
          lead: { select: { reportingGroupId: true } },
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

    // canSendReminder is driven by ReminderPolicy validity windows, not by
    // per-report ReminderRule presence. The UI signal `hasActiveReminderRule`
    // keeps its wire-format name to avoid a cross-cutting rename, but its
    // semantics are: "∃ at least one active ReminderPolicy whose validity
    // window covers this Report.deadline". The policy-driven scheduler
    // materialises ReminderRule rows lazily, so gating on per-period rule
    // existence would mis-match it.
    const activePolicyCount = await this.prisma.reminderPolicy.count({
      where: {
        active: true,
        validFrom: { lte: report.deadline },
        OR: [{ validUntil: null }, { validUntil: { gte: report.deadline } }],
      },
    });

    const snapshot = parsePublishedSnapshot(report.publishedSnapshot);
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

      // D1: on a published period the read model is built from the
      // snapshot, not from the live project rows — so the audit signal
      // must only name products the caller actually receives. Intersect
      // the live rows with the snapshot-surfaced product ids before
      // computing the signal; otherwise a GroupProduct edge added after
      // publish would emit scopeAccessed for data absent from the
      // response (false audit-trail entry for every viewer read).
      const surfacedProductIds = new Set(
        leadSections.flatMap((section) =>
          section.projects.map((project) => project.projectId),
        ),
      );
      const crossGroup = computeCrossGroupSignal(
        session,
        projects.filter((project) => surfacedProductIds.has(project.id)),
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

    const mappedSections: ReportSectionReadModel[] =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch
      (report.sections as any[]).map(mapPrismaToReportSection);
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
}
