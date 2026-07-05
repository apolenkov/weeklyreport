/**
 * Translates `weeklyReport.get` (`WeeklyReportReadModel`) into the slices the
 * existing Weekly Report and `/reports/[reportId]` pages expect:
 *
 *   - `period`       : period-nav metadata (id, weekLabel, dateRange, isCurrent)
 *   - `portfolio`    : per-product summary rows for the overview table
 *   - `products`     : per-product accordion sections (current / next / risks /
 *                      decisions / priorities)
 *
 * The presentation types live in `./weekly-report-types` and the section
 * grouping/formatting helpers in `./weekly-report-groupers` (R3a-4 max-lines
 * split); both are re-exported here so existing importers are unaffected.
 *
 * Synthesis notes (Phase 21 / Plan 21-04):
 * - `weeklyReport.get` returns `leadSections: ReportSectionReadModel[]` (sliced
 *   per LEAD). We re-slice by `projectId` across all leadSections, then attach
 *   risks/decisions/priorities.
 * - `weeklyReport.portfolioOverview` already provides per-product `worstStatus`
 *   + `leadNames`; we use it directly. Counts are derived from the re-sliced
 *   items.
 */
import type { WeeklyReportReadModel } from "@customreport/shared";

import { statusLabel } from "../status-presentation";
import { reportHasContent } from "./report-content";
import {
  buildProductToAuthorMap,
  buildProjectNameMap,
  findNeedsAttention,
  formatWeekRange,
  groupDecisionsByProject,
  groupItemsByProject,
  groupPrioritiesByProject,
  groupRisksByProject,
  initialsFromName,
  isoWeekLabel,
  statusLabelFor,
  trafficToProductStatus,
} from "./weekly-report-groupers";
import type {
  LeadOverviewRow,
  MapWeeklyReportResult,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
  WeeklyProductStatus,
  WeeklyReportPeriod,
} from "./weekly-report-types";

export { formatWeekRange } from "./weekly-report-groupers";
export type * from "./weekly-report-types";

/**
 * Compose `weeklyReport.get` into the page's portfolio + per-product slices.
 */
export function mapWeeklyReport(
  api: WeeklyReportReadModel,
): MapWeeklyReportResult {
  const projectNames = buildProjectNameMap(
    api.leadSections,
    api.portfolioOverview,
  );
  const itemsByProject = groupItemsByProject(api.leadSections);
  const risksByProject = groupRisksByProject(api.leadSections, projectNames);
  const decisionsByProject = groupDecisionsByProject(
    api.leadSections,
    projectNames,
  );
  const prioritiesByProject = groupPrioritiesByProject(api.leadSections);
  const authorsByProject = buildProductToAuthorMap(api.leadSections);

  // Portfolio rows + per-product reports — driven by api.portfolioOverview
  // (already aggregated server-side).
  const portfolio: WeeklyPortfolioProduct[] = [];
  const products: WeeklyProductReport[] = [];

  for (const overview of api.portfolioOverview) {
    const status = trafficToProductStatus(overview.worstStatus);
    const items = itemsByProject.get(overview.productId) ?? {
      current: [],
      next: [],
    };
    const risks = risksByProject.get(overview.productId) ?? [];
    const decisions = decisionsByProject.get(overview.productId) ?? [];
    const priorities = prioritiesByProject.get(overview.productId) ?? [];
    const leadsLabel =
      overview.leadNames.length > 0
        ? overview.leadNames.join(" · ")
        : "unassigned";
    const initials = initialsFromName(overview.productName);

    portfolio.push({
      id: overview.productId,
      initials,
      name: overview.productName,
      status,
      statusLabel: statusLabelFor(status, overview.leadNames),
      leads: leadsLabel,
      currentWeekCount: items.current.length,
      nextWeekCount: items.next.length,
      riskCount: risks.length,
    });

    const attention = findNeedsAttention(api, overview.productName);

    products.push({
      id: overview.productId,
      authorIds: authorsByProject.get(overview.productId) ?? [],
      initials,
      name: overview.productName,
      status,
      statusLabel: statusLabel(status, "print"),
      leads: leadsLabel,
      ...(attention.needsAttention !== undefined
        ? { needsAttention: attention.needsAttention }
        : {}),
      ...(attention.needsAttentionSeverity !== undefined
        ? { needsAttentionSeverity: attention.needsAttentionSeverity }
        : {}),
      currentWeek: items.current,
      nextWeek: items.next,
      risks,
      decisions,
      priorities,
    });
  }

  const period: WeeklyReportPeriod = {
    id: api.reportId,
    reportId: api.reportId,
    periodStatus: api.periodStatus,
    weekLabel: api.weekLabel ?? isoWeekLabel(api.periodStart),
    dateRange: formatWeekRange(api.periodStart, api.periodEnd),
    isCurrent: api.periodStatus !== "published",
  };

  return {
    period,
    portfolio,
    products,
    submissionLabel: `${api.submissionCount}/${api.totalLeads} submitted`,
    periodStatus: api.periodStatus,
    submissionCount: api.submissionCount,
    totalLeads: api.totalLeads,
  };
}

/**
 * report-card-clarity: build the head report's "by lead" groups so each product
 * card under a lead shows ONLY that lead's own contribution (their items, risks,
 * decisions, stages) — not the cross-lead aggregate. Each `api.leadSections`
 * entry is already sliced per lead, so we run the per-product groupers over that
 * single section. The previous page-side bucketing reused the aggregate cards,
 * so a product authored by two leads repeated the whole merged card under each.
 *
 * "By product" scope keeps using {@link mapWeeklyReport}'s aggregate `products`.
 */
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
      const itemsByProject = groupItemsByProject(single);
      const risksByProject = groupRisksByProject(single, projectNames);
      const decisionsByProject = groupDecisionsByProject(single, projectNames);
      const prioritiesByProject = groupPrioritiesByProject(single);

      const products: WeeklyProductReport[] = section.projects
        .map((proj) => {
          const items = itemsByProject.get(proj.projectId) ?? {
            current: [],
            next: [],
          };
          const risks = risksByProject.get(proj.projectId) ?? [];
          const decisions = decisionsByProject.get(proj.projectId) ?? [];
          const priorities = prioritiesByProject.get(proj.projectId) ?? [];
          const status = trafficToProductStatus(proj.trafficLight);
          // This lead's own escalation for this product, if any.
          const attention = api.escalations.find(
            (e) =>
              e.productName === proj.projectName &&
              e.leadName === section.authorName,
          );

          return {
            id: proj.projectId,
            authorIds: [section.authorId],
            initials: initialsFromName(proj.projectName),
            name: proj.projectName,
            status,
            statusLabel: statusLabel(status, "print"),
            leads: section.authorName,
            ...(attention
              ? {
                  needsAttention: attention.description,
                  needsAttentionSeverity:
                    attention.type === "blocked"
                      ? ("blocked" as const)
                      : ("at-risk" as const),
                }
              : {}),
            currentWeek: items.current,
            nextWeek: items.next,
            risks,
            decisions,
            priorities,
          } satisfies WeeklyProductReport;
        })
        .filter(reportHasContent);

      return { id: section.authorId, name: section.authorName, products };
    })
    .filter((group) => group.products.length > 0);
}

// report-overview-scope-parity: status precedence for the per-lead overview —
// blocked (worst) < at-risk < on-track. Lower rank = worse, so the overview
// sorts ascending (worst first) and the worst-of fold keeps the lowest rank.
const LEAD_STATUS_RANK: Record<WeeklyProductStatus, number> = {
  blocked: 0,
  "at-risk": 1,
  "on-track": 2,
};

/**
 * report-overview-scope-parity: derive the `by lead` Report overview rows from
 * the already-computed lead groups (the output of `mapWeeklyReportLeadGroups`).
 * One row per lead WITH content — membership inherits the body's content filter
 * (the groups are already pruned of empty leads), so a decisions-only or
 * Needs-Attention-only lead still gets a row. Pure mapping: no new server data.
 *
 * `worstStatus` is the worst traffic light across the lead's sliced products
 * (their own contribution); counts are summed over those products. Rows sort
 * worst-status-first, ties broken by lead name — a total, stable order matching
 * the product overview's status-first sort.
 */
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
      worstStatus: group.products.reduce<WeeklyProductStatus>(
        (worst, p) =>
          LEAD_STATUS_RANK[p.status] < LEAD_STATUS_RANK[worst]
            ? p.status
            : worst,
        "on-track",
      ),
      currentCount: sumOver(group.products, (p) => p.currentWeek.length),
      nextCount: sumOver(group.products, (p) => p.nextWeek.length),
      riskCount: sumOver(group.products, (p) => p.risks.length),
    }))
    .sort(
      (a, b) =>
        LEAD_STATUS_RANK[a.worstStatus] - LEAD_STATUS_RANK[b.worstStatus] ||
        a.name.localeCompare(b.name),
    );
}

// Internal exports for tests.
export const __testing = {
  initialsFromName,
  isoWeekLabel,
  trafficToProductStatus,
  statusLabelFor,
  formatWeekRange,
};
