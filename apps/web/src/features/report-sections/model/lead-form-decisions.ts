import type { ReportSectionReadModel } from "@customreport/shared";

import { toIsoDateString } from "../../../shared/lib/format/format-date";
import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { DecisionEntry, PriorityEntry } from "./types";

export type LeadDecisionEntry = DecisionEntry;
export type LeadPriorityEntry = PriorityEntry;

type SectionItem = ReportSectionReadModel["items"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];

function requireDecisionId(decision: SectionDecision): string {
  if (typeof decision.id === "string" && decision.id.length > 0) {
    return decision.id;
  }
  throw new Error("Decision is missing id");
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
  return "Unknown";
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
  projectIndex: ReturnType<typeof buildProjectIndex>,
  activityNameById: ReturnType<typeof buildActivityIndex>,
): LeadDecisionEntry {
  return {
    id: requireDecisionId(decision),
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
  // Product-parented and activity-parented decisions render in the Decisions
  // section; parentless records use the invalid-input label.
  return section.decisions.map((decision) =>
    mapDecision(decision, projectIndex, activityNameById),
  );
}

export function mapLeadPriorities(
  section: ReportSectionReadModel,
): readonly LeadPriorityEntry[] {
  const projectIndex = buildProjectIndex(section);
  // Priorities are product-side; activity items are never product priorities.
  return section.items
    .filter(
      (i): i is SectionItem & { projectId: string; priorityRank: number } =>
        i.priorityRank != null &&
        Number.isInteger(i.priorityRank) &&
        i.priorityRank > 0 &&
        i.projectId != null,
    )
    .sort((a, b) => {
      return a.priorityRank - b.priorityRank;
    })
    .map((i) => ({
      rank: i.priorityRank,
      text: i.text,
      stageNames: i.stageNames,
      productId: i.projectId,
      productName: projectIndex.get(i.projectId)?.name ?? undefined,
    }));
}
