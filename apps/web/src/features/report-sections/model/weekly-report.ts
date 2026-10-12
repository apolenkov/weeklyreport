// Maps weeklyReport.get into aggregate and per-lead presentation slices.
import type { WeeklyReportReadModel } from "@weeklyreport/shared";
import {
  buildEscalationsFromReadSections,
  CANONICAL_STATUS_PRECEDENCE,
  shortNameFromName,
  worstCanonicalStatus,
} from "@weeklyreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
} from "../../../shared/lib/format/format-date";
import { compareBySeverityThenName } from "../../../shared/lib/status/status-order";
import { statusLabel } from "../../../shared/lib/status/status-presentation";
import { reportHasContent } from "./report-content";
import {
  buildProjectNameMap,
  groupItemsByProject,
  groupRisksByProject,
  initialsFromName,
  trafficToProductStatus,
} from "./weekly-report-groupers";
import {
  groupDecisionsByProject,
  groupPrioritiesByProject,
} from "./weekly-report-groupers-decisions";
import {
  buildWeeklyReportProjectionContext,
  type ProjectedWeeklyProduct,
  projectWeeklyProduct,
} from "./weekly-report-projection";
import type {
  LeadOverviewRow,
  MapWeeklyReportResult,
  WeeklyProductReport,
  WeeklyProductStatus,
  WeeklyReportPeriod,
} from "./weekly-report-types";

export type * from "./weekly-report-types";

function buildWeeklyReportPeriod(
  api: WeeklyReportReadModel,
): WeeklyReportPeriod {
  return {
    id: api.reportId,
    periodStart: api.periodStart,
    reportId: api.reportId,
    periodState: api.periodState,
    periodStatus: api.periodStatus,
    archived: api.archived,
    weekLabel: api.weekLabel ?? formatWeekLabel(api.periodStart),
    dateRange: formatPeriodRangeWithYear(api.periodStart, api.periodEnd),
    // This projection has no actual-active identity, so it cannot claim Current.
    isCurrent: false,
  };
}

function assembleWeeklyReport(
  api: WeeklyReportReadModel,
  period: WeeklyReportPeriod,
  projections: readonly ProjectedWeeklyProduct[],
): MapWeeklyReportResult {
  return {
    period,
    portfolio: projections.map(({ portfolio }) => portfolio),
    products: projections.map(({ product }) => product),
    submissionLabel: `${api.submissionCount}/${api.totalLeads} submitted`,
    periodStatus: api.periodStatus,
    submissionCount: api.submissionCount,
    totalLeads: api.totalLeads,
  };
}

export function mapWeeklyReport(
  api: WeeklyReportReadModel,
): MapWeeklyReportResult {
  const context = buildWeeklyReportProjectionContext(api);
  // Overview tiles and the section list share this one severity order.
  const projections = api.portfolioOverview
    .map((overview) => projectWeeklyProduct(overview, context))
    .toSorted((a, b) => compareBySeverityThenName(a.product, b.product));
  return assembleWeeklyReport(api, buildWeeklyReportPeriod(api), projections);
}

type LeadSection = WeeklyReportReadModel["leadSections"][number];
type LeadProject = LeadSection["projects"][number];
type LeadProductCandidate = Pick<
  LeadProject,
  "projectId" | "projectName" | "trafficLight"
>;

function leadProductCandidates(
  section: LeadSection,
  projectNames: ReadonlyMap<string, string>,
): LeadProductCandidate[] {
  const candidates = new Map<string, LeadProductCandidate>(
    section.projects.map((project) => [project.projectId, project]),
  );
  const addReferenced = (projectId: string, projectName?: string) => {
    if (candidates.has(projectId)) return;
    candidates.set(projectId, {
      projectId,
      projectName: projectNames.get(projectId) ?? projectName ?? "Unknown",
      trafficLight: null,
    });
  };

  section.referencedProjects.forEach((project) =>
    addReferenced(project.projectId, project.projectName),
  );
  section.items.forEach((item) => {
    if (item.projectId) addReferenced(item.projectId);
  });
  section.risks.forEach((risk) => {
    if (risk.projectId) addReferenced(risk.projectId);
  });
  section.decisions.forEach((decision) => {
    if (decision.productId) addReferenced(decision.productId);
  });

  return [...candidates.values()];
}

// Records the lead filed for one of their products, already sliced by project.
interface LeadProductRecords {
  readonly items: {
    readonly current: WeeklyProductReport["currentWeek"];
    readonly next: WeeklyProductReport["nextWeek"];
  };
  readonly risks: WeeklyProductReport["risks"];
  readonly decisions: WeeklyProductReport["decisions"];
  readonly priorities: WeeklyProductReport["priorities"];
}

function buildLeadProductReport(
  section: LeadSection,
  proj: LeadProductCandidate,
  records: LeadProductRecords,
  signals: {
    readonly escalations: WeeklyReportReadModel["escalations"];
    readonly hasOwnRedProductSignal: boolean;
  },
): WeeklyProductReport {
  const status = trafficToProductStatus(proj.trafficLight);
  const attention = signals.escalations.find(
    (escalation) =>
      escalation.productId === proj.projectId &&
      escalation.authorId === section.authorId,
  );

  return {
    ...(signals.hasOwnRedProductSignal ? { hasOwnRedProductSignal: true } : {}),
    id: proj.projectId,
    authorIds: [section.authorId],
    initials: initialsFromName(proj.projectName),
    name: proj.projectName,
    status,
    statusLabel: statusLabel(status, "screen"),
    leads: shortNameFromName(section.authorName),
    ...(attention
      ? {
          needsAttention: attention.description,
          needsAttentionSeverity:
            attention.type === "blocked"
              ? ("blocked" as const)
              : ("at-risk" as const),
        }
      : {}),
    currentWeek: records.items.current,
    nextWeek: records.items.next,
    risks: records.risks,
    decisions: records.decisions,
    priorities: records.priorities,
  } satisfies WeeklyProductReport;
}

// Per-lead groups use each leadSection alone so dual-authored products are not
// repeated under every lead; by-product scope uses mapWeeklyReport aggregates.
export function mapWeeklyReportLeadGroups(
  api: WeeklyReportReadModel,
): { id: string; name: string; products: WeeklyProductReport[] }[] {
  const projectNames = buildProjectNameMap(
    api.leadSections,
    api.portfolioOverview,
  );

  return api.leadSections
    .map((section) => {
      const single = [section];
      const ownRedProducts = new Set(
        buildEscalationsFromReadSections(single)
          .filter((row) => row.type === "at_risk")
          .map((row) => row.productId),
      );
      const itemsByProject = groupItemsByProject(single);
      const risksByProject = groupRisksByProject(single, projectNames);
      const decisionsByProject = groupDecisionsByProject(single, projectNames);
      const prioritiesByProject = groupPrioritiesByProject(single);

      const products: WeeklyProductReport[] = leadProductCandidates(
        section,
        projectNames,
      )
        .map((proj) =>
          buildLeadProductReport(
            section,
            proj,
            {
              items: itemsByProject.get(proj.projectId) ?? {
                current: [],
                next: [],
              },
              risks: risksByProject.get(proj.projectId) ?? [],
              decisions: decisionsByProject.get(proj.projectId) ?? [],
              priorities: prioritiesByProject.get(proj.projectId) ?? [],
            },
            {
              escalations: api.escalations,
              hasOwnRedProductSignal: ownRedProducts.has(proj.projectId),
            },
          ),
        )
        .filter(reportHasContent);

      return { id: section.authorId, name: section.authorName, products };
    })
    .filter((group) => group.products.length > 0);
}

function compareProductStatus(
  left: WeeklyProductStatus,
  right: WeeklyProductStatus,
): number {
  return CANONICAL_STATUS_PRECEDENCE[right] - CANONICAL_STATUS_PRECEDENCE[left];
}

function worstProductStatus(
  products: readonly WeeklyProductReport[],
): WeeklyProductStatus {
  return worstCanonicalStatus(products.map((product) => product.status));
}

// Overview rows inherit the groups' content filter (decisions-only leads keep a
// row). worstStatus is over the lead's own products; sort worst-first, name tiebreak.
export function mapWeeklyReportLeadOverview(
  leadGroups: readonly {
    id: string;
    name: string;
    products: readonly WeeklyProductReport[];
  }[],
): LeadOverviewRow[] {
  const sumOver = (
    products: readonly WeeklyProductReport[],
    pick: (p: WeeklyProductReport) => number,
  ) => products.reduce((total, p) => total + pick(p), 0);

  return leadGroups
    .map((group) => ({
      id: group.id,
      name: group.name,
      worstStatus: worstProductStatus(group.products),
      currentCount: sumOver(group.products, (p) => p.currentWeek.length),
      nextCount: sumOver(group.products, (p) => p.nextWeek.length),
      riskCount: sumOver(group.products, (p) => p.risks.length),
    }))
    .sort(
      (a, b) =>
        compareProductStatus(a.worstStatus, b.worstStatus) ||
        a.name.localeCompare(b.name),
    );
}
