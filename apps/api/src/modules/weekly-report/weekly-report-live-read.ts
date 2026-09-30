import {
  computeReminderFireAt,
  computeReportProgress,
  reminderPolicyAppliesTo,
  type ReportSectionReadModel,
  type UserSession,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { editableReminderReportWhere } from "../reminders/index.js";
import { mapPrismaToReportSection } from "../report-sections/index.js";
import { isDesignatedReviewer } from "../review/index.js";
import { computeCrossGroupSignal } from "./cross-group-signal.js";
import type {
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";
import {
  buildLiveResult,
  deriveScopeFilters,
  isOrgWideProgressRole,
  requireLiveGroupName,
  type WeeklyReportLiveSection,
  type WeeklyReportProjectRow,
  type WeeklyReportRow,
} from "./weekly-report-read-model.js";

type WeeklyReportDb = PrismaService | Prisma.TransactionClient;

export async function buildLiveReportResult(
  db: WeeklyReportDb,
  report: WeeklyReportRow,
  session: UserSession,
): Promise<WeeklyReportRepositoryResult> {
  const { userScope, projectScope } = deriveScopeFilters(session);
  const { progressLeads, progressSections, projects, activeDeadlineRuleId } =
    await fetchReportDependencies(
      db,
      report,
      isOrgWideProgressRole(session) ? undefined : userScope,
      projectScope,
    );
  const crossGroup = computeCrossGroupSignal(session, projects);
  const leadSections = await buildLiveSections(db, report, session);
  const progress = computeReportProgress(
    progressLeads.map((lead) => lead.id),
    progressSections,
  );

  return buildLiveResult(report, leadSections, projects, {
    crossGroup,
    progress,
    activeDeadlineRuleId,
  });
}

async function fetchReportDependencies(
  db: WeeklyReportDb,
  report: WeeklyReportRow,
  progressScope: Record<string, unknown> | undefined,
  projectScope: Record<string, unknown> | undefined,
): Promise<{
  readonly progressLeads: { id: string }[];
  readonly progressSections: { authorId: string; status: string }[];
  readonly projects: WeeklyReportProjectRow[];
  readonly activeDeadlineRuleId: string | null;
}> {
  const [progressLeads, progressSections, projects, activeDeadlineRule] =
    await Promise.all([
      db.user.findMany({
        where: { role: "lead", isActive: true, ...progressScope },
        select: { id: true },
      }),
      db.reportSection.findMany({
        where: {
          reportId: report.id,
          ...(progressScope ? { author: progressScope } : {}),
        },
        select: { authorId: true, status: true },
      }),
      db.project.findMany({
        where: { archived: false, ...projectScope },
        include: {
          lead: { select: { reportingGroupId: true } },
          stageAssignments: true,
        },
      }),
      report.deadline === null
        ? Promise.resolve(null)
        : db.reminderRule.findFirst({
            where: {
              reportId: report.id,
              kind: "deadline",
              status: "active",
              deadline: report.deadline,
              policy: { active: true },
              report: editableReminderReportWhere,
            },
            orderBy: { version: "desc" },
            select: { id: true, fireAt: true, timezone: true, policy: true },
          }),
    ]);

  return {
    progressLeads,
    progressSections,
    projects,
    activeDeadlineRuleId:
      activeDeadlineRule &&
      report.deadline &&
      activeDeadlineRule.policy.kind === "deadline" &&
      activeDeadlineRule.timezone === activeDeadlineRule.policy.timezone &&
      reminderPolicyAppliesTo(activeDeadlineRule.policy, report.deadline) &&
      activeDeadlineRule.fireAt.getTime() ===
        computeReminderFireAt(
          report.deadline,
          activeDeadlineRule.policy.offsetMinutes,
        ).getTime()
        ? activeDeadlineRule.id
        : null,
  };
}

async function buildLiveSections(
  db: WeeklyReportDb,
  report: WeeklyReportRow,
  session: UserSession,
): Promise<WeeklyReportLiveSection[]> {
  const sectionGroupIds = new Map<string, string | null>(
    report.sections.map((section) => [
      section.id,
      section.author.reportingGroupId ?? null,
    ]),
  );
  const distinctGroupIds = [
    ...new Set(
      [...sectionGroupIds.values()].filter(
        (groupId): groupId is string => groupId !== null,
      ),
    ),
  ];
  const [viewerReviewGroupIds, namesByGroupId] = await Promise.all([
    resolveViewerReviewGroupIds(db, session, distinctGroupIds),
    resolveGroupNames(db, distinctGroupIds),
  ]);
  const mappedSections: ReportSectionReadModel[] = report.sections.map(
    mapPrismaToReportSection,
  );

  return mappedSections.map((section) => {
    const groupId = sectionGroupIds.get(section.reportSectionId) ?? null;
    return {
      ...section,
      groupId,
      groupName: requireLiveGroupName(groupId, namesByGroupId),
      canReview:
        groupId !== null &&
        isDesignatedReviewer(
          session,
          groupId,
          viewerReviewGroupIds.has(groupId),
        ),
    };
  });
}

async function resolveGroupNames(
  db: WeeklyReportDb,
  distinctGroupIds: readonly string[],
): Promise<Map<string, string>> {
  if (distinctGroupIds.length === 0) return new Map();
  const rows = await db.reportingGroup.findMany({
    where: { id: { in: [...distinctGroupIds] } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name] as const));
}

async function resolveViewerReviewGroupIds(
  db: WeeklyReportDb,
  session: WeeklyReportScopeSession,
  distinctGroupIds: readonly string[],
): Promise<Set<string>> {
  if (session.role !== "viewer" || distinctGroupIds.length === 0) {
    return new Set();
  }
  const rows = await db.viewerGroupAccess.findMany({
    where: {
      viewerUserId: session.userId,
      groupId: { in: [...distinctGroupIds] },
      canReview: true,
    },
    select: { groupId: true },
  });
  return new Set(rows.map((row) => row.groupId));
}
