import {
  buildPortfolioProductsFromSnapshotSections,
  computeReportProgress,
  type PublishedReportSnapshot,
  type ReportProgress,
  type ReportSectionReadModel,
  type UserSession,
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { guardGroupScope } from "../../lib/group-scope.js";
import {
  buildEscalationsFromReadSections,
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

// Head and admin run the period lifecycle across every group, so their
// progress denominator is org-wide; other roles stay inside their groups.
export function isOrgWideProgressRole(
  session: Pick<UserSession, "role">,
): boolean {
  return session.role === "head" || session.role === "admin";
}

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
    // Product scope follows the explicit GroupProduct owner rather than the
    // lead's group, so lead rotation does not change product ownership.
    projectScope: scopeWhere(session, "project"),
  };
}

export function buildSnapshotResult(
  report: WeeklyReportMetadata,
  snapshot: PublishedReportSnapshot,
  session: UserSession,
): WeeklyReportRepositoryResult {
  const scopedSnapshot = requireScopedPublishedSnapshot(snapshot, session);
  const readModel = buildPublishedReadModelFromSnapshot(
    scopedSnapshot,
    {
      periodState: report.periodState,
      periodStatus: report.periodStatus,
      archived: report.archived,
      weekLabel: report.weekLabel,
    },
    computeSnapshotProgress(
      isOrgWideProgressRole(session) ? snapshot : scopedSnapshot,
    ),
  );
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

function computeSnapshotProgress(
  snapshot: PublishedReportSnapshot,
): ReportProgress {
  return computeReportProgress(
    snapshot.sections.map((section) => section.authorId),
    snapshot.sections,
  );
}

/** Builds the weekly read model solely from an already-scoped frozen snapshot. */
export function buildPublishedReadModelFromSnapshot(
  snapshot: PublishedReportSnapshot,
  metadata: Pick<
    WeeklyReportMetadata,
    "periodState" | "periodStatus" | "archived" | "weekLabel"
  >,
  progress: ReportProgress = computeSnapshotProgress(snapshot),
): WeeklyReportReadModel {
  const leadSections = snapshot.sections;
  return weeklyReportReadModelSchema.parse({
    reportId: snapshot.reportId,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    deadline: snapshot.deadline,
    periodState: metadata.periodState,
    periodStatus: metadata.periodStatus,
    archived: metadata.archived,
    weekLabel: metadata.weekLabel,
    submissionCount: progress.submitted,
    totalLeads: progress.total,
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
  progress: ReportProgress,
  activeDeadlineRuleId: string | null,
): WeeklyReportRepositoryResult {
  // Statuses come from the floored `leadSections` so a card cannot disagree
  // with the escalations in this same payload; membership still comes from the
  // scoped `projects` list, keeping untouched group-owned products present.
  const portfolioOverview = buildPortfolioOverview(projects, leadSections);

  // Use the shared escalation builder for both live and published read models.
  const escalations = buildEscalationsFromReadSections(leadSections);

  return {
    readModel: weeklyReportReadModelSchema.parse({
      reportId: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      deadline: report.deadline,
      periodState: report.periodState,
      periodStatus: report.periodStatus,
      archived: report.archived,
      weekLabel: report.weekLabel,
      submissionCount: progress.submitted,
      totalLeads: progress.total,
      activeDeadlineReminderRuleId: activeDeadlineRuleId,
      portfolioOverview,
      leadSections,
      escalations,
    }),
    crossGroup,
  };
}
