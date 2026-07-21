/**
 * Grouping + formatting helpers for {@link mapWeeklyReport} in `./weekly-report`.
 * Pure functions that re-slice `weeklyReport.get` sections by product.
 *
 * Decision/priority grouping + the escalation lookup live in
 * `./weekly-report-groupers-decisions` (split out to keep this file focused
 * on the item/risk re-slicing that shares the section-flattening shape).
 */
import type {
  PortfolioProductOverview,
  ReportSectionReadModel,
} from "@customreport/shared";
import { initialsFromName as sharedInitialsFromName } from "@customreport/shared";

import type { AlarmRisk } from "../../../lib/item-alarm";
import { statusLabel } from "../../../lib/status-presentation";
import { deriveHeadItemStatus } from "./item-status";
import { trafficToStageStatus } from "./traffic-light";
import type {
  WeeklyProductStatus,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "./weekly-report-types";

type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];

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
 * One item re-shaped into its head-report row. `index` is the item's
 * 0-based position within its (projectId, type) bucket at the time it is
 * appended — the fallback id embeds it so two legacy ids never collide.
 */
function deriveWeeklyReportItem(
  item: SectionItem & { projectId: string },
  section: ReportSectionReadModel,
  initials: string,
  alarmRisks: readonly AlarmRisk[],
  index: number,
): WeeklyReportItem {
  // The badge shows the item's REAL stage tags (stageIds carries stage
  // names); the previous hardcoded "Dev ·" label mislabelled every item.
  const stagePart = (item.stageIds ?? []).join("+");
  const stageLead = stagePart ? `${stagePart} · ${initials}` : initials;
  return {
    id: item.id ?? `${item.projectId}-${item.type}-${index}`,
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
}

/**
 * Group items across all sections by `projectId`. Returns a map keyed by
 * projectId of `{ current: WeeklyReportItem[], next: WeeklyReportItem[] }`.
 */
export function groupItemsByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, { current: WeeklyReportItem[]; next: WeeklyReportItem[] }> {
  return sections.reduce((map, section) => {
    const initials = initialsFromName(section.authorName);
    // record-status-derived-from-risk: the covering risks the head badge overlay
    // reads (blocked-only) — same shape the lead card derives from.
    const alarmRisks: AlarmRisk[] = section.risks.map((risk) => ({
      productId: risk.projectId ?? "",
      stageIds: risk.stageIds ?? undefined,
      severity: risk.severity,
      text: risk.risk,
    }));
    // activity-first-class: activity-parented items (projectId null) render
    // under their activity, not a product column — filtered out here so the
    // reduce below can narrow `item.projectId` to `string` via a type guard.
    return section.items
      .filter(
        (item): item is SectionItem & { projectId: string } =>
          item.projectId != null,
      )
      .reduce((innerMap, item) => {
        const bucket = innerMap.get(item.projectId) ?? {
          current: [],
          next: [],
        };
        const mapped = deriveWeeklyReportItem(
          item,
          section,
          initials,
          alarmRisks,
          bucket[item.type].length,
        );
        const nextBucket = {
          ...bucket,
          [item.type]: [...bucket[item.type], mapped],
        };
        return new Map(innerMap).set(item.projectId, nextBucket);
      }, map);
  }, new Map<string, { current: WeeklyReportItem[]; next: WeeklyReportItem[] }>());
}

/** One risk re-shaped into its head-report row; `index` seeds the fallback id. */
function deriveWeeklyReportRisk(
  section: ReportSectionReadModel,
  projectNames: ReadonlyMap<string, string>,
  risk: SectionRisk & { projectId: string },
  index: number,
): WeeklyReportRisk {
  const productName = projectNames.get(risk.projectId) ?? "Unknown";
  const text = `${risk.risk} — Impact: ${risk.impact} — Mitigation: ${risk.mitigation}`;
  // Same hardcoded-"Dev" fix as items: show the risk's real stage tags.
  const riskStages = (risk.stageIds ?? []).join("+");
  return {
    id: risk.id ?? `risk-${section.reportSectionId}-${index}`,
    badge: riskStages ? `${productName} · ${riskStages}` : productName,
    // Gutter fields for the redesigned risk row; `badge`/`text` stay for print.
    stage: riskStages,
    owner: initialsFromName(section.authorName),
    severity: risk.severity,
    text,
    problem: risk.risk,
    impact: risk.impact,
    mitigation: risk.mitigation,
    comments: risk.comments ?? [],
    canReview: section.canReview ?? false,
  };
}

/**
 * Group risks across all sections by `projectId`.
 *
 * `projectNames` is the REPORT-WIDE id→name map (fix-product-name-resolution):
 * resolving only against the owning section's projects rendered "Unknown" for
 * cross-author/secondary project references.
 */
export function groupRisksByProject(
  sections: readonly ReportSectionReadModel[],
  projectNames: ReadonlyMap<string, string>,
): Map<string, WeeklyReportRisk[]> {
  return sections.reduce((map, section) => {
    // activity-first-class: activity-parented risks (projectId null) render
    // under their activity, not a product column — filtered out here so the
    // reduce below can narrow `risk.projectId` to `string` via a type guard.
    return section.risks
      .filter(
        (risk): risk is SectionRisk & { projectId: string } =>
          risk.projectId != null,
      )
      .reduce((innerMap, risk) => {
        const list = innerMap.get(risk.projectId) ?? [];
        const mapped = deriveWeeklyReportRisk(
          section,
          projectNames,
          risk,
          list.length,
        );
        return new Map(innerMap).set(risk.projectId, [...list, mapped]);
      }, map);
  }, new Map<string, WeeklyReportRisk[]>());
}
