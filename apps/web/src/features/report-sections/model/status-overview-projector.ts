import type {
  CanonicalStatus,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import {
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@weeklyreport/shared";

import { activityDisplayTitle } from "../../../shared/lib/activity/activity-display";
import { deriveEffectiveStageStatus } from "../../../shared/lib/status/stage-status";
import type {
  StatusOverviewProjectionSource,
  StatusOverviewSection,
  StatusOverviewStage,
  StatusOverviewUnit,
  StatusOverviewUnitKind,
} from "./status-overview";
import {
  buildStatusOverviewColumns,
  statusOverviewItemParent,
} from "./status-overview-items";

type SectionProject = ReportSectionReadModel["projects"][number];
type SectionActivity = ReportSectionReadModel["activities"][number];

function projectStatus(
  section: StatusOverviewSection,
  project: SectionProject,
): {
  readonly status: CanonicalStatus;
  readonly stages: StatusOverviewStage[];
} {
  const stages = project.ownedStages.map((stage) => {
    const coveringRisks = section.risks.filter(
      (risk) =>
        risk.projectId === project.projectId &&
        risk.risk.trim().length > 0 &&
        risk.stageNames.includes(stage.stageName),
    );
    return {
      name: stage.stageName,
      status: deriveEffectiveStageStatus(
        trafficLightToCanonical(stage.status),
        coveringRisks,
      ),
    };
  });
  return {
    status:
      stages.length > 0
        ? worstCanonicalStatus(stages.map((stage) => stage.status))
        : trafficLightToCanonical(project.trafficLight),
    stages,
  };
}

function collectParentIds(
  sections: readonly StatusOverviewSection[],
  kind: StatusOverviewUnitKind,
): readonly string[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => {
      const parent = statusOverviewItemParent(item);
      return parent?.kind === kind ? [parent.id] : [];
    }),
  );
}

export function collectOrderedStatusOverviewUnitIds(
  current: StatusOverviewSection,
  previous: StatusOverviewSection | null,
  kind: StatusOverviewUnitKind,
): readonly string[] {
  const currentIds =
    kind === "product"
      ? current.projects.map((project) => project.projectId)
      : current.activities.map((activity) => activity.activityId);
  const previousIds = previous
    ? kind === "product"
      ? previous.projects.map((project) => project.projectId)
      : previous.activities.map((activity) => activity.activityId)
    : [];
  const sections = previous ? [current, previous] : [current];
  return [
    ...new Set([
      ...currentIds,
      ...previousIds,
      ...collectParentIds(sections, kind),
    ]),
  ];
}

function productName(
  id: string,
  sections: readonly StatusOverviewSection[],
): string {
  for (const section of sections) {
    const project = section.projects.find((entry) => entry.projectId === id);
    if (project) return project.projectName;
    const referenced = section.referencedProjects.find(
      (entry) => entry.projectId === id,
    );
    if (referenced) return referenced.projectName;
  }
  return "Historical product";
}

function buildProductPresentation(
  id: string,
  current: StatusOverviewSection,
  previous: StatusOverviewSection | null,
): Pick<
  StatusOverviewUnit,
  "name" | "historical" | "status" | "stages" | "linkedProducts"
> {
  const currentProject = current.projects.find(
    (entry) => entry.projectId === id,
  );
  const previousProject = previous?.projects.find(
    (entry) => entry.projectId === id,
  );
  const project = currentProject ?? previousProject;
  const source = currentProject ? current : previous;
  const projected = project && source ? projectStatus(source, project) : null;
  return {
    name: productName(id, previous ? [current, previous] : [current]),
    historical: currentProject == null,
    status: projected?.status ?? "empty",
    stages: projected?.stages ?? [],
    linkedProducts: [],
  };
}

function buildActivityPresentation(
  id: string,
  current: StatusOverviewSection,
  previous: StatusOverviewSection | null,
): Pick<
  StatusOverviewUnit,
  | "name"
  | "historical"
  | "status"
  | "stages"
  | "linkedProducts"
  | "activityFields"
> {
  const currentActivity = current.activities.find(
    (entry) => entry.activityId === id,
  );
  const previousActivity = previous?.activities.find(
    (entry) => entry.activityId === id,
  );
  const activity: SectionActivity | undefined =
    currentActivity ?? previousActivity;
  return {
    name: activity ? activityDisplayTitle(activity) : "Historical activity",
    historical: currentActivity == null,
    status: trafficLightToCanonical(
      activity?.derivedStatus ?? activity?.status,
    ),
    stages: [],
    linkedProducts: [
      ...new Set(
        activity?.linkedProducts.map((product) => product.productName) ?? [],
      ),
    ],
    activityFields: {
      titleOverride: activity?.titleOverride ?? null,
      description: activity?.note ?? null,
      catalogueName: activity?.activityName ?? "Historical activity",
    },
  };
}

export function buildStatusOverviewUnit(
  kind: StatusOverviewUnitKind,
  id: string,
  input: StatusOverviewProjectionSource,
  previous: StatusOverviewSection | null,
): StatusOverviewUnit {
  const presentation =
    kind === "product"
      ? buildProductPresentation(id, input.currentSection, previous)
      : buildActivityPresentation(id, input.currentSection, previous);
  return {
    key: `${kind}:${id}`,
    id,
    kind,
    ...presentation,
    records: [
      ...input.currentSection.risks
        .filter(
          (row) => (kind === "product" ? row.projectId : row.activityId) === id,
        )
        .map((risk, index) => ({
          key: `risk:${risk.stableId ?? risk.id ?? index}`,
          stableId: risk.stableId,
          kind: "risk" as const,
          text: risk.risk,
          details: [
            ["Impact", risk.impact],
            ["Mitigation", risk.mitigation],
            ["Severity", risk.severity],
          ] as const,
        })),
      ...(input.currentSection.decisions ?? [])
        .filter(
          (row) => (kind === "product" ? row.productId : row.activityId) === id,
        )
        .map((decision, index) => ({
          key: `decision:${decision.stableId ?? decision.id ?? index}`,
          stableId: decision.stableId,
          kind: "decision" as const,
          text: decision.text,
          details: [
            ["Impact", decision.impact],
            ["Owner", decision.owner],
          ] as const,
        })),
    ],
    columns: buildStatusOverviewColumns(kind, id, input, previous),
  };
}
