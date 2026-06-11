import {
  type Escalation,
  type PortfolioProductOverview,
  weeklyReportReadModelSchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  groupScopeFilter,
  type GroupScopeOptions,
} from "../../lib/group-scope.js";
import {
  buildEscalationsFromSnapshotSections,
  buildPortfolioProductsFromSnapshotSections,
  filterSnapshotSections,
  parsePublishedSnapshot,
} from "../published-report-snapshot.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/report-sections.prisma-repository.js";
import type {
  WeeklyReportRepository,
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";

@Injectable()
export class WeeklyReportPrismaRepository implements WeeklyReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveReportId(): Promise<string | null> {
    const editableReport = await this.prisma.report.findFirst({
      where: { periodStatus: { in: ["open", "reopened"] } },
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

  async getWeeklyReport(
    reportId: string,
    session?: WeeklyReportScopeSession,
  ): Promise<WeeklyReportRepositoryResult | null> {
    const sectionScope = scopeWhere(session, "reportSection");
    const userScope = scopeWhere(session, "user");
    // UFB-054 / Phase 56-D consumer migration: the weekly-report portfolio
    // is the only `'project'`-target scope-filter consumer in the api. Its
    // semantics are "what products does this group currently own?" — that
    // matches the explicit GroupProduct M:M edge introduced in Phase 56-A,
    // not the implicit `lead.reportingGroupId` derivation. Opt this site
    // into the explicit edge so a product attached to two groups via the
    // join surfaces in both heads' weekly reports, and a lead rotation
    // does not silently drop a product from its group's portfolio.
    //
    // Lead's write path (saveDraft / submit) does not flow through this
    // helper — it goes through `auth.routes.ts` with `leadId: userId`
    // directly — so flipping this site only affects READ visibility.
    //
    // scope-filter-migration status (Phase 56-D + audit-scope-filter-migration):
    // COMPLETE — useExplicitGroupProducts: true routes project scope through the
    // explicit GroupProduct join table instead of the legacy lead.reportingGroupId
    // derivation. All three scope axes (section, user, project) are applied via
    // scopeWhere() below. Defensive guardGroupScope() is exported from group-scope.ts
    // for use when callers must assert that session is non-null.
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

    const leadUsers = await this.prisma.user.findMany({
      where: { role: "lead", ...userScope },
      select: { id: true },
    });

    // D1: add lead.reportingGroupId to detect cross-group products.
    // The thin extra select adds one column to an already-fetched row —
    // no extra round-trip.
    const projects = await this.prisma.project.findMany({
      where: { archived: false, ...projectScope },
      include: {
        stageAssignments: true,
        lead: { select: { reportingGroupId: true } },
      },
    });

    const submissionCount = report.sections.filter(
      (s) => s.status === "submitted",
    ).length;

    const totalLeads = leadUsers.length;
    // UFB-047 / Phase 49-01: brand label removed from the weekly read
    // model. Frontends read `auth.me.organization.fullName` instead, so
    // the API path no longer touches `AppSettings` here.

    // Phase 48-C (UFB-038): canSendReminder is now driven by ReminderPolicy
    // validity windows (Phase 44 model), not by legacy per-report
    // ReminderRule presence. The UI signal `hasActiveReminderRule` keeps its
    // wire-format name to avoid a cross-cutting rename, but its semantics
    // are now: "∃ at least one active ReminderPolicy whose validity window
    // covers this Report.deadline". Without this migration, head/admin
    // dashboards still showed "Send Reminder" gated on the legacy
    // per-period rule existence, which mis-matches the new policy-driven
    // scheduler that materialises ReminderRule rows lazily.
    const activePolicyCount = await this.prisma.reminderPolicy.count({
      where: {
        active: true,
        validFrom: { lte: report.deadline },
        OR: [{ validUntil: null }, { validUntil: { gte: report.deadline } }],
      },
    });

    // D1: compute the cross-group signal for the router to emit
    // scopeAccessed. Admin sessions produce no scope filter and are never
    // cross-group callers; non-session paths also skip.
    const crossGroup = computeCrossGroupSignal(session, projects);

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
          escalations: buildEscalationsFromSnapshotSections(leadSections),
        }),
        crossGroup,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
    const leadSections = (report.sections as any[]).map(
      mapPrismaToReportSection,
    );

    const portfolioOverview = buildPortfolioOverview(projects, report.sections);

    const escalations = buildEscalations(report.sections, projects);

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
}

// ---------------------------------------------------------------------------
//  Portfolio overview: one entry per (non-archived) project
// ---------------------------------------------------------------------------

function buildPortfolioOverview(
  projects: {
    id: string;
    name: string;
    stageAssignments: { id: string }[];
  }[],
  sections: {
    // Prisma returns `status: TrafficLightStatus | null`; null statuses
    // skip the totals.
    projectStatuses: { projectId: string; status: string | null }[];
    authorId: string;
    author: { name: string };
  }[],
): PortfolioProductOverview[] {
  return projects.map((project) => {
    const statuses: string[] = [];
    const leadNameSet = new Set<string>();

    for (const section of sections) {
      for (const ps of section.projectStatuses) {
        // null status = lead hasn't filled the traffic light for this
        // project yet; skip it so the worst-of computation isn't muddied
        // by missing data.
        if (ps.projectId === project.id && ps.status !== null) {
          statuses.push(ps.status);
          leadNameSet.add(section.author.name);
        }
      }
    }

    const worstStatus = computeWorstStatus(statuses);

    return {
      productId: project.id,
      productName: project.name,
      worstStatus,
      stageCount: project.stageAssignments.length,
      leadNames: [...leadNameSet].sort((a, b) => a.localeCompare(b, "ru")),
    };
  });
}

const statusSeverity: Record<string, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

function computeWorstStatus(
  statuses: string[],
): "green" | "yellow" | "red" | null {
  if (statuses.length === 0) {
    return null;
  }

  let worst = "green";

  for (const s of statuses) {
    if ((statusSeverity[s] ?? 0) > (statusSeverity[worst] ?? 0)) {
      worst = s;
    }
  }

  return worst as "green" | "yellow" | "red";
}

// ---------------------------------------------------------------------------
//  Escalations: blocked items, at-risk (red) projects, unresolved risks
// ---------------------------------------------------------------------------

function buildEscalations(
  sections: {
    authorId: string;
    author: { name: string };
    // Prisma yields `status: TrafficLightStatus | null`; null skips the row.
    projectStatuses: {
      projectId: string;
      status: string | null;
      project: { id: string; name: string };
    }[];
    items: {
      projectId: string;
      workflowStatus: string;
      text: string;
    }[];
    risks: {
      projectId: string;
      risk: string;
    }[];
  }[],
  projects: { id: string; name: string }[],
): Escalation[] {
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));
  const escalations: Escalation[] = [];

  for (const section of sections) {
    // Blocked items
    for (const item of section.items) {
      if (item.workflowStatus === "blocked") {
        escalations.push({
          type: "blocked",
          productName: projectNameMap.get(item.projectId) ?? "Unknown",
          stageName: null,
          leadName: section.author.name,
          description: item.text,
        });
      }
    }

    // At-risk projects (red traffic light)
    for (const ps of section.projectStatuses) {
      if (ps.status === "red") {
        escalations.push({
          type: "at_risk",
          productName: ps.project.name,
          stageName: null,
          leadName: section.author.name,
          description: `Project ${ps.project.name} is flagged red.`,
        });
      }
    }

    // Unresolved risks
    for (const risk of section.risks) {
      escalations.push({
        type: "unresolved_risk",
        productName: projectNameMap.get(risk.projectId) ?? "Unknown",
        stageName: null,
        leadName: section.author.name,
        description: risk.risk,
      });
    }
  }

  return escalations;
}

/**
 * UFB-040 / Phase 46-04: build a Prisma where fragment for the given scope
 * target from the caller's session, or `undefined` when no filter applies
 * (admin or no-session paths).
 */
function scopeWhere(
  session: WeeklyReportScopeSession | undefined,
  target: "user" | "reportSection" | "project",
  options: GroupScopeOptions = {},
): Record<string, unknown> | undefined {
  if (!session) return undefined;
  const scope = groupScopeFilter(
    session as Parameters<typeof groupScopeFilter>[0],
    target,
    options,
  );
  if (Object.keys(scope).length === 0) return undefined;
  return scope;
}

/**
 * D1: compute the cross-group audit signal from the fetched projects.
 *
 * A product is cross-group when its lead's `reportingGroupId` (natural
 * owner) is NOT in the caller's allowed group ids, yet it surfaced via
 * the explicit GroupProduct join. Admin sessions and unscoped paths
 * produce no signal (admin has no scope filter; unauthenticated paths
 * are not audited).
 *
 * Per-request dedupe (D3) is achieved by collapsing all cross-group
 * products into one signal object — the router emits a single event.
 */
function computeCrossGroupSignal(
  session: WeeklyReportScopeSession | undefined,
  projects: { id: string; lead: { reportingGroupId: string | null } | null }[],
): WeeklyReportRepositoryResult["crossGroup"] {
  if (!session || session.role === "admin") return null;

  const allowedGroupIds = getAllowedGroupIds(session);
  if (allowedGroupIds.length === 0) return null;

  const allowedSet = new Set(allowedGroupIds);
  const crossGroupProductIds: string[] = [];
  const crossGroupGroupIdSet = new Set<string>();

  for (const project of projects) {
    const ownerGroupId = project.lead?.reportingGroupId ?? null;
    if (ownerGroupId !== null && !allowedSet.has(ownerGroupId)) {
      crossGroupProductIds.push(project.id);
      crossGroupGroupIdSet.add(ownerGroupId);
    }
  }

  if (crossGroupProductIds.length === 0) return null;

  return {
    productIds: crossGroupProductIds,
    groupIds: [...crossGroupGroupIdSet],
  };
}

/** Extract allowed group ids from a scoped (non-admin) session. */
function getAllowedGroupIds(session: WeeklyReportScopeSession): string[] {
  if (session.role === "head" || session.role === "lead") {
    return session.reportingGroupId ? [session.reportingGroupId] : [];
  }
  if (session.role === "viewer") {
    return session.viewerGroupAccess ?? [];
  }
  return [];
}
