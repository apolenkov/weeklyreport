import type { ReportSectionReadModel } from "@customreport/shared";

import { toIsoDateString } from "../../../shared/lib/format/format-date";
import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { DecisionEntry, PriorityEntry } from "./types";

export type LeadDecisionEntry = DecisionEntry;
export type LeadPriorityEntry = PriorityEntry;

type SectionItem = ReportSectionReadModel["items"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];

function clampRank(rank: number): number {
  // Keep ranks ≥ 1 (schema requires a positive int) but no upper clamp —
  // the priority list is variable-length, so any rank is renderable.
  if (rank < 1 || !Number.isInteger(rank)) return 1;
  return rank;
}

function resolveDecisionProductName(
  decision: SectionDecision,
  projectIndex: ReturnType<typeof buildProjectIndex>,
  activityNameById: ReturnType<typeof buildActivityIndex>,
): string {
  if (decision.productId) {
    return projectIndex.get(decision.productId)?.name ?? "Group";
  }
  if (decision.activityId) {
    return activityNameById.get(decision.activityId) ?? "Unknown";
  }
  return "Group";
}

function resolveDecisionActivity(
  decision: SectionDecision,
  activityNameById: ReturnType<typeof buildActivityIndex>,
) {
  if (!decision.activityId) return {};
  return {
    activityId: decision.activityId,
    activityName: activityNameById.get(decision.activityId) ?? "Unknown",
  };
}

function mapDecision(
  decision: SectionDecision,
  index: number,
  projectIndex: ReturnType<typeof buildProjectIndex>,
  activityNameById: ReturnType<typeof buildActivityIndex>,
): LeadDecisionEntry {
  return {
    id: decision.id ?? `decision-${index}`,
    ...(decision.stableId === undefined ? {} : { stableId: decision.stableId }),
    productId: decision.productId ?? "",
    productName: resolveDecisionProductName(
      decision,
      projectIndex,
      activityNameById,
    ),
    ...resolveDecisionActivity(decision, activityNameById),
    text: decision.text,
    owner: decision.owner,
    impact: decision.impact,
    deadline: decision.deadline
      ? toIsoDateString(new Date(decision.deadline))
      : null,
    stageNames: decision.stageNames,
  };
}

export function mapLeadDecisions(
  section: ReportSectionReadModel,
): readonly LeadDecisionEntry[] {
  const projectIndex = buildProjectIndex(section);
  const activityNameById = buildActivityIndex(section);
  // Product-parented, legacy parentless ("Group"), AND activity-parented
  // decisions all render in the Decisions section — activity rows labeled
  // with the activity name.
  return section.decisions.map((decision, index) =>
    mapDecision(decision, index, projectIndex, activityNameById),
  );
}

export function mapLeadPriorities(
  section: ReportSectionReadModel,
): readonly LeadPriorityEntry[] {
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
      stageNames: i.stageNames,
      productId: i.projectId,
      productName: projectIndex.get(i.projectId)?.name ?? undefined,
    }));
}
