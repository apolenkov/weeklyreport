/**
 * Grouping + formatting helpers for {@link mapWeeklyReport} in `./weekly-report`.
 * Extracted from that module (R3a-4 max-lines split) — pure functions that
 * re-slice `weeklyReport.get` sections by product. No behavior change.
 */
import type {
  PortfolioProductOverview,
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";

import { formatPeriodRangeWithYear, formatWeekLabel } from "../format-date";
import { deriveItemStatus } from "./item-status";
import { trafficToStageStatus } from "./traffic-light";
import type {
  WeeklyProductStatus,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportPriority,
  WeeklyReportRisk,
} from "./weekly-report-types";

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  if (!first) return "??";
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export function isoWeekLabel(date: Date): string {
  return formatWeekLabel(date);
}

/** Format an inclusive period range as `Apr 14–20, 2026`. */
export function formatWeekRange(start: Date, end: Date): string {
  return formatPeriodRangeWithYear(start, end);
}

export function trafficToProductStatus(
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

export function statusLabelFor(
  status: WeeklyProductStatus,
  leadNames: string[],
): string {
  const leads = leadNames.length > 0 ? leadNames.join(", ") : "unassigned";
  switch (status) {
    case "on-track":
      return `On Track · ${leads}`;
    case "at-risk":
      return `At Risk · ${leads}`;
    case "blocked":
      return `Blocked · ${leads}`;
  }
}

/**
 * Report-wide projectId→productName map (fix-product-name-resolution):
 * every section's projects, with the portfolio overview (server-aggregated,
 * names every product) winning on conflict. Badge resolution goes through
 * this so cross-author/secondary references never render "Unknown".
 */
export function buildProjectNameMap(
  sections: readonly ReportSectionReadModel[],
  portfolioOverview: readonly PortfolioProductOverview[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const section of sections) {
    for (const project of section.projects) {
      names.set(project.projectId, project.projectName);
    }
  }
  for (const overview of portfolioOverview) {
    names.set(overview.productId, overview.productName);
  }
  return names;
}

/**
 * Group items across all sections by `projectId`. Returns a map keyed by
 * projectId of `{ current: WeeklyReportItem[], next: WeeklyReportItem[] }`.
 */
export function groupItemsByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, { current: WeeklyReportItem[]; next: WeeklyReportItem[] }> {
  const map = new Map<
    string,
    { current: WeeklyReportItem[]; next: WeeklyReportItem[] }
  >();
  for (const section of sections) {
    const initials = initialsFromName(section.authorName);
    for (const item of section.items) {
      const bucket = map.get(item.projectId) ?? { current: [], next: [] };
      // The badge shows the item's REAL stage tags (stageIds carries stage
      // names); the previous hardcoded "Dev ·" label mislabelled every item.
      const stagePart = (item.stageIds ?? []).join("+");
      const stageLead = stagePart ? `${stagePart} · ${initials}` : initials;
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
        priorityRank: item.priorityRank ?? null,
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
 *
 * `projectNames` is the REPORT-WIDE id→name map (fix-product-name-resolution):
 * resolving only against the owning section's projects rendered "Unknown" for
 * cross-author/secondary project references.
 */
export function groupRisksByProject(
  sections: readonly ReportSectionReadModel[],
  projectNames: ReadonlyMap<string, string>,
): Map<string, WeeklyReportRisk[]> {
  const map = new Map<string, WeeklyReportRisk[]>();
  for (const section of sections) {
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
      const text = `${risk.risk} — Impact: ${risk.impact} — Mitigation: ${risk.mitigation}`;
      // Same hardcoded-"Dev" fix as items: show the risk's real stage tags.
      const riskStages = (risk.stageIds ?? []).join("+");
      const list = map.get(risk.projectId) ?? [];
      list.push({
        id: risk.id ?? `risk-${section.reportSectionId}-${list.length}`,
        badge: riskStages ? `${productName} · ${riskStages}` : productName,
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
 *
 * `projectNames` is the report-wide id→name map — see groupRisksByProject.
 */
export function groupDecisionsByProject(
  sections: readonly ReportSectionReadModel[],
  projectNames: ReadonlyMap<string, string>,
): Map<string, WeeklyReportDecision[]> {
  const decisions = new Map<string, WeeklyReportDecision[]>();

  for (const section of sections) {
    const firstProject = section.projects.at(0);

    const resolveProduct = (productId: string | null | undefined) => {
      if (productId) {
        return {
          projectId: productId,
          projectName: projectNames.get(productId) ?? "Unknown",
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
export function groupPrioritiesByProject(
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

export function buildProductToAuthorMap(
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
export function findNeedsAttention(
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
