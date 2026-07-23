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
 * grouping/formatting helpers in `./weekly-report-groupers` (item/risk
 * re-slicing) and `./weekly-report-groupers-decisions` (decisions/priorities/
 * authors/escalations); all are re-exported here so existing importers are
 * unaffected.
 *
 * How the slices are derived:
 * - `weeklyReport.get` returns `leadSections: ReportSectionReadModel[]` (sliced
 *   per LEAD). We re-slice by `projectId` across all leadSections, then attach
 *   risks/decisions/priorities.
 * - `weeklyReport.portfolioOverview` already provides per-product `worstStatus`
 *   + `leadNames`; we use it directly. Counts are derived from the re-sliced
 *   items.
 */
import type {
  TrafficLightStatus,
  WeeklyReportReadModel,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
} from "../../../lib/format-date";
import {
  statusLabel,
  worstTrafficStatus,
} from "../../../lib/status-presentation";
import { reportHasContent } from "./report-content";
import {
  buildProjectNameMap,
  groupItemsByProject,
  groupRisksByProject,
  initialsFromName,
  statusLabelFor,
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
    reportId: api.reportId,
    periodStatus: api.periodStatus,
    weekLabel: api.weekLabel ?? formatWeekLabel(api.periodStart),
    dateRange: formatPeriodRangeWithYear(api.periodStart, api.periodEnd),
    isCurrent: api.periodStatus !== "published",
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

/** Compose `weeklyReport.get` into the page's portfolio + per-product slices. */
export function mapWeeklyReport(
  api: WeeklyReportReadModel,
): MapWeeklyReportResult {
  const context = buildWeeklyReportProjectionContext(api);
  const projections = api.portfolioOverview.map((overview) =>
    projectWeeklyProduct(overview, context),
  );
  return assembleWeeklyReport(api, buildWeeklyReportPeriod(api), projections);
}

/**
 * Build the head report's "by lead" groups so each product card under a lead
 * shows ONLY that lead's own contribution (their items, risks, decisions,
 * stages) — not the cross-lead aggregate. Each `api.leadSections` entry is
 * already sliced per lead, so we run the per-product groupers over that single
 * section. Reusing aggregate cards would repeat a dual-authored product's
 * merged content under each lead.
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

function productStatusToTraffic(
  status: WeeklyProductStatus,
): TrafficLightStatus {
  if (status === "blocked") return "red";
  if (status === "at-risk") return "yellow";
  return "green";
}

function compareProductStatus(
  left: WeeklyProductStatus,
  right: WeeklyProductStatus,
): number {
  if (left === right) return 0;
  const leftTraffic = productStatusToTraffic(left);
  return worstTrafficStatus([leftTraffic, productStatusToTraffic(right)]) ===
    leftTraffic
    ? -1
    : 1;
}

/**
 * Derive the `by lead` Report overview rows from the already-computed lead
 * groups (the output of `mapWeeklyReportLeadGroups`). One row per lead WITH
 * content — membership inherits the body's content filter (the groups are
 * already pruned of empty leads), so a decisions-only or Needs-Attention-only
 * lead still gets a row. Pure mapping: no new server data.
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
      worstStatus: trafficToProductStatus(
        worstTrafficStatus(
          group.products.map((product) =>
            productStatusToTraffic(product.status),
          ),
        ),
      ),
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

// Internal exports for tests.
export const __testing = {
  initialsFromName,
  trafficToProductStatus,
  statusLabelFor,
};
