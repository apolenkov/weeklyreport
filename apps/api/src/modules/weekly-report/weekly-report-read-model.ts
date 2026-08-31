import {
  type PublishedReportSnapshot,
  type ReportSectionReadModel,
  type UserSession,
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { guardGroupScope } from "../../lib/group-scope.js";
import {
  buildEscalationsFromReadSections,
  buildPortfolioProductsFromSnapshotSections,
  type reportSectionFullInclude,
  requireScopedPublishedSnapshot,
} from "../report-sections/index.js";
import { computeCrossGroupSignalFromSnapshotProjects } from "./cross-group-signal.js";
import type { WeeklyReportRepositoryResult } from "./weekly-report.service.js";
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

export type WeeklyReportMetadata = Omit<WeeklyReportRow, "sections">;

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
  readonly groupName: string | null;
  readonly canReview: boolean;
};

export function requireLiveGroupName(
  groupId: string | null,
  namesByGroupId: ReadonlyMap<string, string>,
): string | null {
  if (groupId === null) return null;
  const groupName = namesByGroupId.get(groupId);
  if (!groupName) {
    throw new Error(`Live weekly report group ${groupId} has no name`);
  }
  return groupName;
}

export function deriveScopeFilters(
  session: UserSession,
): WeeklyReportScopeFilters {
  guardGroupScope(session);
  return {
    sectionScope: scopeWhere(session, "reportSection"),
    userScope: scopeWhere(session, "user"),
    // Ownership here is the explicit GroupProduct M:M edge, not the implicit
    // `lead.reportingGroupId` derivation: a product joined to two groups must
    // surface in both heads' reports, and a lead rotation must not drop one.
    projectScope: scopeWhere(session, "project"),
  };
}

export function buildSnapshotResult(
  report: WeeklyReportMetadata,
  snapshot: PublishedReportSnapshot,
  session: UserSession,
): WeeklyReportRepositoryResult {
  const scopedSnapshot = requireScopedPublishedSnapshot(snapshot, session);
  const readModel = buildPublishedReadModelFromSnapshot(scopedSnapshot, {
    periodStatus: report.periodStatus,
    archived: report.archived,
    weekLabel: report.weekLabel,
  });
  const leadSections = readModel.leadSections;

  // The signal comes from owner groups frozen INTO the snapshot, never a live
  // re-query: a product since archived or since detached from its group would
  // drop out of the live query yet still be delivered by the snapshot.
  const crossGroup = computeCrossGroupSignalFromSnapshotProjects(
    session,
    leadSections.flatMap((section) => section.projects),
  );

  return {
    readModel,
    crossGroup,
  };
}

/** Builds the weekly read model solely from an already-scoped frozen snapshot. */
export function buildPublishedReadModelFromSnapshot(
  snapshot: PublishedReportSnapshot,
  metadata: Pick<
    WeeklyReportMetadata,
    "periodStatus" | "archived" | "weekLabel"
  >,
): WeeklyReportReadModel {
  const leadSections = snapshot.sections;
  return weeklyReportReadModelSchema.parse({
    reportId: snapshot.reportId,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    deadline: snapshot.deadline,
    periodStatus: metadata.periodStatus,
    archived: metadata.archived,
    weekLabel: metadata.weekLabel,
    submissionCount: leadSections.filter(
      (section) => section.status === "submitted",
    ).length,
    totalLeads: new Set(leadSections.map((section) => section.authorId)).size,
    activeDeadlineReminderRuleId: null,
    portfolioOverview: buildPortfolioProductsFromSnapshotSections(leadSections),
    leadSections,
    escalations: buildEscalationsFromReadSections(leadSections),
  });
}

export function buildLiveResult(
  report: WeeklyReportRow,
  leadSections: WeeklyReportLiveSection[],
  projects: WeeklyReportProjectRow[],
  crossGroup: WeeklyReportRepositoryResult["crossGroup"],
  submissionCount: number,
  totalLeads: number,
  activeDeadlineRuleId: string | null,
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
      activeDeadlineReminderRuleId: activeDeadlineRuleId,
      portfolioOverview,
      leadSections,
      escalations,
    }),
    crossGroup,
  };
}
