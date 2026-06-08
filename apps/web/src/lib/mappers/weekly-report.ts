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

import {
  buildProductToAuthorMap,
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
  MapWeeklyReportResult,
  WeeklyPortfolioProduct,
  WeeklyProductReport,
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
  const itemsByProject = groupItemsByProject(api.leadSections);
  const risksByProject = groupRisksByProject(api.leadSections);
  const decisionsByProject = groupDecisionsByProject(api.leadSections);
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
      statusLabel:
        status === "on-track"
          ? "On Track"
          : status === "at-risk"
            ? "At Risk"
            : "Blocked",
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

// Internal exports for tests.
export const __testing = {
  initialsFromName,
  isoWeekLabel,
  trafficToProductStatus,
  statusLabelFor,
  formatWeekRange,
};
