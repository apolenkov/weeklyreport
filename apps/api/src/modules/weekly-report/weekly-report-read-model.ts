import {
  type AssembledReport,
  type ReportSectionReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  buildEscalationsFromReadSections,
  buildPortfolioProductsFromSnapshotSections,
  filterSnapshotSections,
  type reportSectionFullInclude,
} from "../report-sections/index.js";
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

export function deriveScopeFilters(
  session: WeeklyReportScopeSession | undefined,
): WeeklyReportScopeFilters {
  return {
    sectionScope: scopeWhere(session, "reportSection"),
    userScope: scopeWhere(session, "user"),
    // Ownership here is the explicit GroupProduct M:M edge, not the implicit
    // `lead.reportingGroupId` derivation: a product joined to two groups must
    // surface in both heads' reports, and a lead rotation must not drop one.
    projectScope: scopeWhere(session, "project", {
      useExplicitGroupProducts: true,
    }),
  };
}

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

  // The signal comes from owner groups frozen INTO the snapshot, never a live
  // re-query: a product since archived or since detached from its group would
  // drop out of the live query yet still be delivered by the snapshot.
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
      archived: report.archived,
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

export function buildLiveResult(
  report: WeeklyReportRow,
  leadSections: WeeklyReportLiveSection[],
  projects: WeeklyReportProjectRow[],
  crossGroup: WeeklyReportRepositoryResult["crossGroup"],
  submissionCount: number,
  totalLeads: number,
  activePolicyCount: number,
): WeeklyReportRepositoryResult {
  // Statuses come from the floored `leadSections` so a card cannot disagree
  // with the escalations in this same payload; membership still comes from the
  // scoped `projects` list, keeping untouched group-owned products present.
  const portfolioOverview = buildPortfolioOverview(projects, leadSections);

  // The SAME builder the published-snapshot path uses, so the Blocked-&-At-Risk
  // panel emits identical stage/product output on both surfaces.
  const escalations = buildEscalationsFromReadSections(leadSections);

  return {
    readModel: weeklyReportReadModelSchema.parse({
      reportId: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      deadline: report.deadline,
      periodStatus: report.periodStatus,
      archived: report.archived,
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
