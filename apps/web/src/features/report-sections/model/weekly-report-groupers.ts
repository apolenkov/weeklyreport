/**
 * Grouping + formatting helpers for {@link mapWeeklyReport} in `./weekly-report`.
 * Pure functions that re-slice `weeklyReport.get` sections by product.
 */
import type {
  PortfolioProductOverview,
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { initialsFromName as sharedInitialsFromName } from "@customreport/shared";

import { statusLabel } from "../../../lib/status-presentation";
import { deriveHeadItemStatus } from "./item-status";
import { trafficToStageStatus } from "./traffic-light";
import type {
  WeeklyProductStatus,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportPriority,
  WeeklyReportRisk,
} from "./weekly-report-types";

// Avatar initials via the canonical shared helper (surname-first ФИО), with
// this surface's "??" placeholder for an empty name. The token logic lives once
// in @customreport/shared so cloned copies can't diverge.
export function initialsFromName(name: string): string {
  return sharedInitialsFromName(name) || "??";
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
  return `${statusLabel(status, "print")} · ${leads}`;
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
    // record-status-derived-from-risk: the covering risks the head badge overlay
    // reads (blocked-only) — same shape the lead card derives from.
    const alarmRisks = section.risks.map((risk) => ({
      productId: risk.projectId ?? "",
      stageIds: risk.stageIds ?? undefined,
      severity: risk.severity ?? ("at-risk" as const),
      text: risk.risk,
    }));
    for (const item of section.items) {
      // activity-first-class: activity-parented items (projectId null) render
      // under their activity, not a product column — skip them here.
      if (item.projectId == null) continue;
      const bucket = map.get(item.projectId) ?? { current: [], next: [] };
      // The badge shows the item's REAL stage tags (stageIds carries stage
      // names); the previous hardcoded "Dev ·" label mislabelled every item.
      const stagePart = (item.stageIds ?? []).join("+");
      const stageLead = stagePart ? `${stagePart} · ${initials}` : initials;
      const mapped: WeeklyReportItem = {
        id:
          item.id ??
          `${item.projectId}-${item.type}-${bucket[item.type].length}`,
        // stageLead is kept for the print template's `[{stageLead}]`; the
        // redesigned accordion reads `stage`/`owner` instead. Next-week stays
        // "Planned" in stageLead (print back-compat) while stage/owner carry the
        // real values the accordion shows on every row.
        stageLead: item.type === "next" ? "Planned" : stageLead,
        stage: stagePart,
        owner: initials,
        text: item.text,
        status: deriveHeadItemStatus(
          {
            workflowStatus: item.workflowStatus,
            type: item.type,
            projectId: item.projectId,
            stageIds: item.stageIds,
          },
          alarmRisks,
        ),
        priorityRank: item.priorityRank ?? null,
        // review-acknowledgement: carry the reviewer comments + this caller's
        // review capability for the section so the accordion row can surface
        // them (comments anchor to the DB `id`, threaded above).
        comments: item.comments ?? [],
        canReview: section.canReview ?? false,
      };
      bucket[item.type].push(mapped);
      map.set(item.projectId, bucket);
    }
  }
  return map;
}

/**
 * Group risks across all sections by `projectId`. A risk missing an explicit
 * severity defaults to `'at-risk'` (there is no stored blocked item status to
 * infer from — rework-item-status-model).
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
    for (const risk of section.risks) {
      // activity-first-class: activity-parented risks (projectId null) render
      // under their activity, not a product column — skip them here.
      if (risk.projectId == null) continue;
      const productName = projectNames.get(risk.projectId) ?? "Unknown";
      const severity: "blocked" | "at-risk" = risk.severity ?? "at-risk";
      const text = `${risk.risk} — Impact: ${risk.impact} — Mitigation: ${risk.mitigation}`;
      // Same hardcoded-"Dev" fix as items: show the risk's real stage tags.
      const riskStages = (risk.stageIds ?? []).join("+");
      const list = map.get(risk.projectId) ?? [];
      list.push({
        id: risk.id ?? `risk-${section.reportSectionId}-${list.length}`,
        badge: riskStages ? `${productName} · ${riskStages}` : productName,
        // Gutter fields for the redesigned risk row; `badge`/`text` stay for print.
        stage: riskStages,
        owner: initialsFromName(section.authorName),
        severity,
        text,
        problem: risk.risk,
        impact: risk.impact,
        mitigation: risk.mitigation,
        comments: risk.comments ?? [],
        canReview: section.canReview ?? false,
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
      // activity-first-class: activity-parented decisions render under their
      // activity, not a product — skip so they never fall back to firstProject.
      if (d.activityId != null) return;
      const targetProduct = resolveProduct(d.productId);
      if (!targetProduct) return;
      const decisionList = decisions.get(targetProduct.projectId) ?? [];
      decisionList.push({
        id: d.id ?? `decision-${section.reportSectionId}-${idx}`,
        badge: targetProduct.projectName,
        owner: initialsFromName(section.authorName),
        text: d.text,
        comments: d.comments ?? [],
        canReview: section.canReview ?? false,
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
      // activity-first-class: a product priority is product-parented; skip
      // activity items (projectId null).
      if (item.projectId == null) continue;
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
