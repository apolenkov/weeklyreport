import {
  type AssembledReport,
  type ReportSectionReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  buildPortfolioProductsFromSnapshotSections,
  filterSnapshotSections,
} from "../published-report-snapshot.js";
import { buildEscalationsFromReadSections } from "../report-escalations.js";
import type { reportSectionFullInclude } from "../report-sections/index.js";
import { computeCrossGroupSignalFromSnapshotProjects } from "./cross-group-signal.js";
import type {
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";
import {
  buildPortfolioOverview,
  scopeWhere,
} from "./weekly-report-portfolio.js";

// The report row as fetched by `getWeeklyReport`, derived from the same
// `reportSectionFullInclude` every other report-section read shares — never a
// hand-written mirror of the query's `include` shape.
export type WeeklyReportRow = Prisma.ReportGetPayload<{
  include: { sections: { include: typeof reportSectionFullInclude } };
}>;

// The live project row shape queried on the non-published render path
// (skipped entirely on the snapshot path — see `fetchReportDependencies`).
export type WeeklyReportProjectRow = Prisma.ProjectGetPayload<{
  include: {
    lead: { select: { reportingGroupId: true } };
    stageAssignments: true;
  };
}>;

export interface WeeklyReportScopeFilters {
  readonly sectionScope: Record<string, unknown> | undefined;
  readonly userScope: Record<string, unknown> | undefined;
  readonly projectScope: Record<string, unknown> | undefined;
}

// A live-path section stamped with its author's group and this caller's
// review affordance — see `buildLiveSections` in the repository.
export type WeeklyReportLiveSection = ReportSectionReadModel & {
  readonly groupId: string | null;
  readonly canReview: boolean;
};

/**
 * Derive Scope Filters.
 * @param session - The session argument.
 */
export function deriveScopeFilters(
  session: WeeklyReportScopeSession | undefined,
): WeeklyReportScopeFilters {
  return {
    sectionScope: scopeWhere(session, "reportSection"),
    userScope: scopeWhere(session, "user"),
    // The weekly-report portfolio is the only `'project'`-target
    // scope-filter consumer in the api. Its semantics are "what products
    // does this group currently own?" — that matches the explicit
    // GroupProduct M:M edge, not the implicit `lead.reportingGroupId`
    // derivation. Opt this site into the explicit edge so a product
    // attached to two groups via the join surfaces in both heads' weekly
    // reports, and a lead rotation does not silently drop a product from
    // its group's portfolio.
    //
    // Lead's write path (saveDraft / submit) does not flow through this
    // helper — it goes through `auth.routes.ts` with `leadId: userId`
    // directly — so flipping this site only affects READ visibility.
    projectScope: scopeWhere(session, "project", {
      useExplicitGroupProducts: true,
    }),
  };
}

/**
 * Build Snapshot Result.
 * @param report - The report argument.
 * @param snapshot - The snapshot argument.
 * @param session - The session argument.
 * @param sectionScope - The sectionScope argument.
 * @param totalLeads - The totalLeads argument.
 * @param activePolicyCount - The activePolicyCount argument.
 */
export function buildSnapshotResult(
  report: WeeklyReportRow,
  snapshot: AssembledReport,
  session: WeeklyReportScopeSession | undefined,
  sectionScope: Record<string, unknown> | undefined,
  totalLeads: number,
  activePolicyCount: number,
): WeeklyReportRepositoryResult {
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

/**
 * Build Live Result.
 * @param report - The report argument.
 * @param leadSections - The leadSections argument.
 * @param projects - The projects argument.
 * @param crossGroup - The crossGroup argument.
 * @param submissionCount - The submissionCount argument.
 * @param totalLeads - The totalLeads argument.
 * @param activePolicyCount - The activePolicyCount argument.
 */
export function buildLiveResult(
  report: WeeklyReportRow,
  leadSections: WeeklyReportLiveSection[],
  projects: WeeklyReportProjectRow[],
  crossGroup: WeeklyReportRepositoryResult["crossGroup"],
  submissionCount: number,
  totalLeads: number,
  activePolicyCount: number,
): WeeklyReportRepositoryResult {
  // Source product-card statuses from the floored read-model sections
  // (`leadSections`), not the raw `report.sections[].projectStatuses`. The
  // mapper already folds the author's own covering risks into each
  // product's `trafficLight`, so an owned stage with status:null covered by
  // a blocked/at-risk own risk reads red/yellow here too — the card no
  // longer disagrees with this same payload's floored leadSections and
  // escalations. Card membership stays driven by the scoped `projects` list
  // (a group-owned product no lead has touched keeps its null card).
  const portfolioOverview = buildPortfolioOverview(projects, leadSections);

  // Map the live Prisma rows to the read model, then run the SAME builder
  // the published-snapshot path uses, so the Blocked-&-At-Risk panel emits
  // byte-identical stage/product output on both surfaces.
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
