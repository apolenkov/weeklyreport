// Grouping helpers for mapWeeklyReport: re-slice weeklyReport.get sections by product.
// Decision/priority grouping lives in ./weekly-report-groupers-decisions.
import type {
  PortfolioProductOverview,
  ReportSectionReadModel,
} from "@customreport/shared";

import type { AlarmRisk } from "../../../lib/item-alarm";
import { statusLabel } from "../../../lib/status-presentation";
import { initialsFromName } from "../../../lib/user-initials";
import { deriveHeadItemStatus } from "./item-status";
import { trafficToStageStatus } from "./traffic-light";
import type {
  WeeklyProductStatus,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "./weekly-report-types";

type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];

// Re-exported so the weekly-report mappers keep one import site for grouping helpers.
export { initialsFromName };

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
  return "empty";
}

export function statusLabelFor(
  status: WeeklyProductStatus,
  leadNames: readonly string[],
): string {
  const leads = leadNames.length > 0 ? leadNames.join(", ") : "unassigned";
  return `${statusLabel(status, "print")} · ${leads}`;
}

// Report-wide projectId→name: section projects first, portfolio overview wins
// on conflict (Map's constructor is last-wins on duplicate keys) so
// cross-author references never render "Unknown".
export function buildProjectNameMap(
  sections: readonly ReportSectionReadModel[],
  portfolioOverview: readonly PortfolioProductOverview[],
): Map<string, string> {
  return new Map([
    ...sections.flatMap((section) =>
      section.projects.map((project): [string, string] => [
        project.projectId,
        project.projectName,
      ]),
    ),
    ...portfolioOverview.map((overview): [string, string] => [
      overview.productId,
      overview.productName,
    ]),
  ]);
}

// `index` is the item's position within its (projectId, type) bucket — the
// fallback id embeds it so two legacy ids never collide.
function deriveWeeklyReportItem(
  item: SectionItem & { projectId: string },
  section: ReportSectionReadModel,
  initials: string,
  alarmRisks: readonly AlarmRisk[],
  index: number,
): WeeklyReportItem {
  const stagePart = (item.stageNames ?? []).join("+");
  const stageLead = stagePart ? `${stagePart} · ${initials}` : initials;
  return {
    id: item.id ?? `${item.projectId}-${item.type}-${index}`,
    // stageLead for print `[{stageLead}]`; accordion reads stage/owner.
    // Next-week stays "Planned" in stageLead (print back-compat).
    stageLead: item.type === "next" ? "Planned" : stageLead,
    stage: stagePart,
    owner: initials,
    text: item.text,
    status: deriveHeadItemStatus(
      {
        workflowStatus: item.workflowStatus,
        type: item.type,
        projectId: item.projectId,
        stageNames: item.stageNames,
      },
      alarmRisks,
    ),
    priorityRank: item.priorityRank ?? null,
    comments: item.comments ?? [],
    canReview: section.canReview ?? false,
  };
}

// Group items by projectId into { current, next }. Activity-parented rows skipped.
export function groupItemsByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, { current: WeeklyReportItem[]; next: WeeklyReportItem[] }> {
  const entries = sections.flatMap((section) => {
    const initials = initialsFromName(section.authorName);
    const alarmRisks: AlarmRisk[] = section.risks.map((risk) => ({
      productId: risk.projectId ?? "",
      stageNames: risk.stageNames ?? undefined,
      severity: risk.severity,
      text: risk.risk,
    }));
    return section.items
      .filter(
        (item): item is SectionItem & { projectId: string } =>
          item.projectId != null,
      )
      .map((item) => ({ item, section, initials, alarmRisks }));
  });

  return new Map(
    [...Map.groupBy(entries, (entry) => entry.item.projectId)].map(
      ([projectId, group]) => {
        const rows = (type: SectionItem["type"]) =>
          group
            .filter((entry) => entry.item.type === type)
            .map((entry, index) =>
              deriveWeeklyReportItem(
                entry.item,
                entry.section,
                entry.initials,
                entry.alarmRisks,
                index,
              ),
            );
        return [projectId, { current: rows("current"), next: rows("next") }];
      },
    ),
  );
}

function deriveWeeklyReportRisk(
  section: ReportSectionReadModel,
  projectNames: ReadonlyMap<string, string>,
  risk: SectionRisk & { projectId: string },
  index: number,
): WeeklyReportRisk {
  const productName = projectNames.get(risk.projectId) ?? "Unknown";
  const text = `${risk.risk} — Impact: ${risk.impact} — Mitigation: ${risk.mitigation}`;
  const riskStages = (risk.stageNames ?? []).join("+");
  return {
    id: risk.id ?? `risk-${section.reportSectionId}-${index}`,
    badge: riskStages ? `${productName} · ${riskStages}` : productName,
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

// Group risks by projectId. projectNames is REPORT-WIDE so cross-author
// references don't render "Unknown".
export function groupRisksByProject(
  sections: readonly ReportSectionReadModel[],
  projectNames: ReadonlyMap<string, string>,
): Map<string, WeeklyReportRisk[]> {
  const entries = sections.flatMap((section) =>
    section.risks
      .filter(
        (risk): risk is SectionRisk & { projectId: string } =>
          risk.projectId != null,
      )
      .map((risk) => ({ section, risk })),
  );

  return new Map(
    [...Map.groupBy(entries, (entry) => entry.risk.projectId)].map(
      ([projectId, group]) => [
        projectId,
        group.map((entry, index) =>
          deriveWeeklyReportRisk(
            entry.section,
            projectNames,
            entry.risk,
            index,
          ),
        ),
      ],
    ),
  );
}
