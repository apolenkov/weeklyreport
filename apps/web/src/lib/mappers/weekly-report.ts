/**
 * Translates `weeklyReport.get` (`WeeklyReportReadModel`) into the slices the
 * existing Weekly Report and `/reports/[reportId]` pages expect:
 *
 *   - `period`       : period-nav metadata (id, weekLabel, dateRange, isCurrent)
 *   - `portfolio`    : per-product summary rows for the overview table
 *   - `products`     : per-product accordion sections (current / next / risks /
 *                      decisions / priorities)
 *
 * Reuses Phase 20 mappers (`trafficToStageStatus`, `deriveItemStatus`).
 *
 * Synthesis notes (Phase 21 / Plan 21-04):
 * - `weeklyReport.get` returns `leadSections: ReportSectionReadModel[]` (sliced
 *   per LEAD). `MOCK_PRODUCT_REPORTS` is sliced per PRODUCT. We re-slice by
 *   `projectId` across all leadSections, then attach risks/decisions/priorities.
 * - `weeklyReport.portfolioOverview` already provides per-product
 *   `worstStatus` + `leadNames`; we use it directly rather than re-deriving.
 *   Counts (`currentWeekCount`, `nextWeekCount`, `riskCount`) are derived from
 *   the re-sliced items.
 * - Decisions and priorities carry optional productId. We group by that
 *   explicit product when present, with a first-project fallback only for
 *   legacy records that predate product-scoped decisions/priorities.
 * - `riskInputSchema.severity` is optional. When older rows omit it, severity
 *   falls back to a blocked-item check for the same product, then to
 *   `'at-risk'`. `badge` is synthesized as `${productName} · Dev`.
 * - `currentWeek[i].stageLead` synthesized as `'Dev · ${initials}'`.
 * - `period.dateRange` formatted as `Apr 14–20, 2026` (en-dash).
 */

import type {
  PortfolioProductOverview,
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { formatPeriodRangeWithYear, formatWeekLabel } from "../format-date";
import { deriveItemStatus, type ItemStatus } from "./item-status";
import { trafficToStageStatus } from "./traffic-light";

// ---- Self-contained presentation types ----

export type WeeklyProductStatus = "on-track" | "at-risk" | "blocked";

export type WeeklyPortfolioProduct = {
  id: string;
  initials: string;
  name: string;
  status: WeeklyProductStatus;
  statusLabel: string;
  leads: string;
  currentWeekCount: number;
  nextWeekCount: number;
  riskCount: number;
};

export type WeeklyReportItem = {
  id: string;
  stageLead: string;
  text: string;
  status: ItemStatus;
};

export type WeeklyReportRisk = {
  id: string;
  badge: string;
  severity: "blocked" | "at-risk";
  text: string;
};

export type WeeklyReportDecision = {
  id: string;
  badge: string;
  text: string;
};

export type WeeklyReportPriority = {
  rank: number;
  text: string;
};

export type WeeklyProductReport = {
  id: string;
  authorIds: string[];
  initials: string;
  name: string;
  status: WeeklyProductStatus;
  statusLabel: string;
  leads: string;
  needsAttention?: string;
  needsAttentionSeverity?: "blocked" | "at-risk";
  currentWeek: WeeklyReportItem[];
  nextWeek: WeeklyReportItem[];
  risks: WeeklyReportRisk[];
  decisions: WeeklyReportDecision[];
  priorities: WeeklyReportPriority[];
};

export type WeeklyReportPeriod = {
  id: string;
  /**
   * Concrete report identifier (UUID). Equal to `id` (which historically was
   * set to `api.reportId`); surfaced explicitly so consumers wiring publish /
   * reopen mutations can read `period.reportId` without relying on the
   * implicit `id === reportId` invariant. Added in Phase 22 (plan 22-05).
   */
  reportId: string;
  /**
   * Period lifecycle state mirrored from the API. Used by the head's
   * Publish & Lock / Reopen toggle to decide which action to render.
   * Phase 22 (plan 22-05).
   */
  periodStatus: "open" | "published" | "reopened";
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
};

// ---- Helpers ----

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  if (!first) return "??";
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function isoWeekLabel(date: Date): string {
  return formatWeekLabel(date);
}

/** Format an inclusive period range as `Apr 14–20, 2026`. */
export function formatWeekRange(start: Date, end: Date): string {
  return formatPeriodRangeWithYear(start, end);
}

function trafficToProductStatus(
  traffic: PortfolioProductOverview["worstStatus"],
): WeeklyProductStatus {
  const presentation = trafficToStageStatus(traffic);
  if (
    presentation === "on-track" ||
    presentation === "at-risk" ||
    presentation === "blocked"
  ) {
    return presentation;
  }
  // 'empty' (worstStatus === null) collapses to 'on-track' for portfolio display.
  return "on-track";
}

function statusLabelFor(
  status: WeeklyProductStatus,
  leadNames: string[],
): string {
  const leads = leadNames.length > 0 ? leadNames.join(", ") : "unassigned";
  switch (status) {
    case "on-track":
      return `On Track \u00b7 ${leads}`;
    case "at-risk":
      return `At Risk \u00b7 ${leads}`;
    case "blocked":
      return `Blocked \u00b7 ${leads}`;
  }
}

/**
 * Group items across all sections by `projectId`. Returns a map keyed by
 * projectId of `{ current: WeeklyReportItem[], next: WeeklyReportItem[] }`.
 */
function groupItemsByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, { current: WeeklyReportItem[]; next: WeeklyReportItem[] }> {
  const map = new Map<
    string,
    { current: WeeklyReportItem[]; next: WeeklyReportItem[] }
  >();
  for (const section of sections) {
    const stageLead = `Dev \u00b7 ${initialsFromName(section.authorName)}`;
    for (const item of section.items) {
      const bucket = map.get(item.projectId) ?? { current: [], next: [] };
      const mapped: WeeklyReportItem = {
        id:
          item.id ??
          `${item.projectId}-${item.type}-${bucket[item.type].length}`,
        stageLead: item.type === "next" ? "Planned" : stageLead,
        text: item.text,
        status: deriveItemStatus({
          workflowStatus: item.workflowStatus,
          type: item.type,
          completed: item.completed ?? null,
        }),
      };
      bucket[item.type].push(mapped);
      map.set(item.projectId, bucket);
    }
  }
  return map;
}

/**
 * Group risks across all sections by `projectId`. Severity is inferred from the
 * lead section's matching item with `workflowStatus === 'blocked'`; otherwise
 * defaults to `'at-risk'`.
 */
function groupRisksByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, WeeklyReportRisk[]> {
  const map = new Map<string, WeeklyReportRisk[]>();
  for (const section of sections) {
    const projectNames = new Map<string, string>();
    for (const project of section.projects) {
      projectNames.set(project.projectId, project.projectName);
    }
    // Detect blocked items per project for legacy risk severity inference.
    const blockedProjects = new Set(
      section.items
        .filter((item) => item.workflowStatus === "blocked")
        .map((item) => item.projectId),
    );
    for (const risk of section.risks) {
      const productName = projectNames.get(risk.projectId) ?? "Unknown";
      const severity: "blocked" | "at-risk" =
        risk.severity ??
        (blockedProjects.has(risk.projectId) ? "blocked" : "at-risk");
      const text = `${risk.risk} \u2014 Impact: ${risk.impact} \u2014 Mitigation: ${risk.mitigation}`;
      const list = map.get(risk.projectId) ?? [];
      list.push({
        id: risk.id ?? `risk-${section.reportSectionId}-${list.length}`,
        badge: `${productName} \u00b7 Dev`,
        severity,
        text,
      });
      map.set(risk.projectId, list);
    }
  }
  return map;
}

/**
 * Group decisions by their explicit productId when present.
 * Legacy entries without productId fall back to the section author's first
 * project. If neither exists, the entry is dropped (no place to render it).
 */
function groupDecisionsByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, WeeklyReportDecision[]> {
  const decisions = new Map<string, WeeklyReportDecision[]>();

  for (const section of sections) {
    const firstProject = section.projects[0];
    const projectsById = new Map(
      section.projects.map((project) => [project.projectId, project] as const),
    );

    const resolveProduct = (productId: string | null | undefined) => {
      if (productId) {
        return {
          projectId: productId,
          projectName: projectsById.get(productId)?.projectName ?? "Unknown",
        };
      }
      return firstProject;
    };

    section.decisions.forEach((d, idx) => {
      const targetProduct = resolveProduct(d.productId);
      if (!targetProduct) return;
      const decisionList = decisions.get(targetProduct.projectId) ?? [];
      decisionList.push({
        id: d.id ?? `decision-${section.reportSectionId}-${idx}`,
        badge: targetProduct.projectName,
        text: d.text,
      });
      decisions.set(targetProduct.projectId, decisionList);
    });
  }

  return decisions;
}

/**
 * Derive priorities from items with priorityRank set, grouped by projectId,
 * sorted by rank ASC within each product.
 */
function groupPrioritiesByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, WeeklyReportPriority[]> {
  const map = new Map<string, WeeklyReportPriority[]>();

  for (const section of sections) {
    const priorityItems = section.items
      .filter((i) => i.priorityRank != null)
      .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0));

    for (const item of priorityItems) {
      const list = map.get(item.projectId) ?? [];
      list.push({ rank: item.priorityRank ?? 1, text: item.text });
      map.set(item.projectId, list);
    }
  }

  return map;
}

function buildProductToAuthorMap(
  sections: readonly ReportSectionReadModel[],
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const section of sections) {
    for (const project of section.projects) {
      const authors = map.get(project.projectId) ?? new Set<string>();
      authors.add(section.authorId);
      map.set(project.projectId, authors);
    }
  }
  return new Map(
    [...map.entries()].map(([productId, authors]) => [productId, [...authors]]),
  );
}

/**
 * Find the first escalation that targets a given product and surface its
 * description as the `needsAttention` banner.
 */
function findNeedsAttention(
  api: WeeklyReportReadModel,
  productName: string,
): { needsAttention?: string; needsAttentionSeverity?: "blocked" | "at-risk" } {
  for (const escalation of api.escalations) {
    if (escalation.productName !== productName) continue;
    const severity: "blocked" | "at-risk" =
      escalation.type === "blocked" ? "blocked" : "at-risk";
    return {
      needsAttention: escalation.description,
      needsAttentionSeverity: severity,
    };
  }
  return {};
}

// ---- Public mapper ----

export type MapWeeklyReportResult = {
  period: WeeklyReportPeriod;
  portfolio: WeeklyPortfolioProduct[];
  products: WeeklyProductReport[];
  /** Header summary string ("4/6 leads submitted"). */
  submissionLabel: string;
  /** raw period state for header/banner UX. */
  periodStatus: WeeklyReportReadModel["periodStatus"];
  /** Submission count (for top-of-page badge). */
  submissionCount: number;
  /** Total leads (for top-of-page badge). */
  totalLeads: number;
};

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
        ? overview.leadNames.join(" \u00b7 ")
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
