import type { ReportSectionReadModel } from "@customreport/shared";

import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { DecisionEntry, PriorityEntry } from "./types";

export type LeadDecisionEntry = DecisionEntry;
export type LeadPriorityEntry = PriorityEntry;

type SectionItem = ReportSectionReadModel["items"][number];

// "YYYY-MM-DD" — length of an ISO date-only prefix.
const ISO_DATE_LENGTH = 10;

function clampRank(rank: number): number {
  // Keep ranks ≥ 1 (schema requires a positive int) but no upper clamp —
  // the priority list is variable-length, so any rank is renderable.
  if (rank < 1 || !Number.isInteger(rank)) return 1;
  return rank;
}

/**
 * Map Lead Decisions.
 * @param section - The section argument.
 */
export function mapLeadDecisions(
  section: ReportSectionReadModel,
): LeadDecisionEntry[] {
  const projectIndex = buildProjectIndex(section);
  const activityNameById = buildActivityIndex(section);
  // Product-parented, legacy parentless ("Group"), AND activity-parented
  // decisions all render in the Decisions section — activity rows labeled
  // with the activity name.
  return section.decisions.map((d, idx) => ({
    id: d.id ?? `decision-${idx}`,
    productId: d.productId ?? "",
    productName:
      (d.productId ? projectIndex.get(d.productId)?.name : undefined) ??
      (d.activityId != null
        ? (activityNameById.get(d.activityId) ?? "Unknown")
        : "Group"),
    ...(d.activityId != null
      ? {
          activityId: d.activityId,
          activityName: activityNameById.get(d.activityId) ?? "Unknown",
        }
      : {}),
    text: d.text,
    owner: d.owner,
    impact: d.impact,
    deadline: d.deadline
      ? new Date(d.deadline).toISOString().slice(0, ISO_DATE_LENGTH)
      : null,
    stageIds: d.stageIds,
  }));
}

/**
 * Map Lead Priorities.
 * @param section - The section argument.
 */
export function mapLeadPriorities(
  section: ReportSectionReadModel,
): LeadPriorityEntry[] {
  const projectIndex = buildProjectIndex(section);
  // Priorities are product-side; activity items are never product priorities.
  return section.items
    .filter(
      (i): i is SectionItem & { projectId: string } =>
        i.priorityRank != null && i.projectId != null,
    )
    .sort((a, b) => {
      const ra = (a.priorityRank ?? 0) >= 1 ? (a.priorityRank ?? 0) : Infinity;
      const rb = (b.priorityRank ?? 0) >= 1 ? (b.priorityRank ?? 0) : Infinity;
      return ra - rb;
    })
    .map((i) => ({
      rank: clampRank(i.priorityRank ?? 0),
      text: i.text,
      stageIds: i.stageIds,
      productId: i.projectId,
      productName: projectIndex.get(i.projectId)?.name ?? undefined,
    }));
}
