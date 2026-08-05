import { trafficLightToCanonical } from "@customreport/shared";

import {
  assertProjectableScope,
  candidateContext,
  candidateIdentity,
  recordSubject,
} from "./candidate-projector.core.js";
import type {
  ActivityStatusCandidate,
  DecisionCandidate,
  ItemCandidate,
  ProductStatusCandidate,
  ReportOccurrence,
  RiskCandidate,
  SearchCandidate,
  SectionScope,
  StageStatusCandidate,
} from "./report-retrieval.types.js";

const projectItems = (
  occurrence: ReportOccurrence,
  section: SectionScope["section"],
): readonly ItemCandidate[] =>
  section.items.flatMap((item) => {
    const subject = recordSubject(section, item);
    if (!subject) return [];
    return [
      {
        kind: "item",
        identity: candidateIdentity(
          occurrence,
          section,
          "item",
          item.id ?? item.stableId ?? `${item.type}:${item.text}`,
          item.stableId,
        ),
        context: candidateContext(
          occurrence,
          section,
          subject,
          item.stageIds ?? [],
        ),
        text: item.text,
        itemType: item.type,
        workflowStatus: item.workflowStatus,
        carriedOver: item.carriedOver,
        priorityRank: item.priorityRank ?? null,
      },
    ];
  });

const projectRisks = (
  occurrence: ReportOccurrence,
  section: SectionScope["section"],
): readonly RiskCandidate[] =>
  section.risks.flatMap((risk) => {
    const subject = recordSubject(section, risk);
    if (!subject) return [];
    return [
      {
        kind: "risk",
        identity: candidateIdentity(
          occurrence,
          section,
          "risk",
          risk.id ?? risk.stableId ?? `${risk.severity}:${risk.risk}`,
          risk.stableId,
        ),
        context: candidateContext(
          occurrence,
          section,
          subject,
          risk.stageIds ?? [],
        ),
        risk: risk.risk,
        impact: risk.impact,
        mitigation: risk.mitigation,
        severity: risk.severity,
      },
    ];
  });

const projectDecisions = (
  occurrence: ReportOccurrence,
  section: SectionScope["section"],
): readonly DecisionCandidate[] =>
  section.decisions.flatMap((decision) => {
    const subject = recordSubject(section, decision);
    if (!subject) return [];
    return [
      {
        kind: "decision",
        identity: candidateIdentity(
          occurrence,
          section,
          "decision",
          decision.id ?? decision.stableId ?? decision.text,
          decision.stableId,
        ),
        context: candidateContext(
          occurrence,
          section,
          subject,
          decision.stageIds ?? [],
        ),
        text: decision.text,
        impact: decision.impact,
        owner: decision.owner,
        deadline: decision.deadline ?? null,
        resolvedAt: decision.resolvedAt ?? null,
      },
    ];
  });

const projectProductStatuses = (
  occurrence: ReportOccurrence,
  section: SectionScope["section"],
): readonly ProductStatusCandidate[] =>
  section.projects.map((project) => ({
    kind: "product_status",
    identity: candidateIdentity(
      occurrence,
      section,
      "product_status",
      project.projectId,
      undefined,
    ),
    context: candidateContext(
      occurrence,
      section,
      { kind: "product", id: project.projectId, name: project.projectName },
      (project.ownedStages ?? []).map((stage) => stage.stageName),
    ),
    status: trafficLightToCanonical(project.trafficLight),
  }));

const projectStageStatuses = (
  occurrence: ReportOccurrence,
  section: SectionScope["section"],
): readonly StageStatusCandidate[] =>
  section.projects.flatMap((project) =>
    (project.ownedStages ?? []).map((stage) => ({
      kind: "stage_status" as const,
      identity: candidateIdentity(
        occurrence,
        section,
        "stage_status",
        `${project.projectId}:${stage.stageId}`,
        undefined,
      ),
      context: candidateContext(
        occurrence,
        section,
        { kind: "product", id: project.projectId, name: project.projectName },
        [stage.stageName],
      ),
      status: trafficLightToCanonical(stage.status),
    })),
  );

const projectActivityStatuses = (
  occurrence: ReportOccurrence,
  section: SectionScope["section"],
): readonly ActivityStatusCandidate[] =>
  section.activities.map((activity) => ({
    kind: "activity_status",
    identity: candidateIdentity(
      occurrence,
      section,
      "activity_status",
      activity.activityId,
      undefined,
    ),
    context: candidateContext(
      occurrence,
      section,
      {
        kind: "activity",
        id: activity.activityId,
        name: activity.activityName,
      },
      [],
    ),
    status: trafficLightToCanonical(activity.derivedStatus ?? activity.status),
    note: activity.note ?? null,
  }));

export function projectSectionCandidates(
  occurrence: ReportOccurrence,
  scope: SectionScope,
): readonly SearchCandidate[] {
  assertProjectableScope(occurrence, scope);
  const { section } = scope;
  return [
    ...projectItems(occurrence, section),
    ...projectRisks(occurrence, section),
    ...projectDecisions(occurrence, section),
    ...projectProductStatuses(occurrence, section),
    ...projectStageStatuses(occurrence, section),
    ...projectActivityStatuses(occurrence, section),
  ];
}
