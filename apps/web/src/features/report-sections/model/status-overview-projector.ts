import type {
  CanonicalStatus,
  ReportSectionReadModel,
} from "@customreport/shared";
import {
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@customreport/shared";

import { deriveEffectiveStageStatus } from "../../../shared/lib/status/stage-status";
import type {
  StatusOverviewItem,
  StatusOverviewProjectionSource,
  StatusOverviewSection,
  StatusOverviewStage,
  StatusOverviewUnit,
  StatusOverviewUnitKind,
} from "./status-overview";

type SectionItem = ReportSectionReadModel["items"][number];
type SectionProject = ReportSectionReadModel["projects"][number];
type SectionActivity = ReportSectionReadModel["activities"][number];

function itemParent(item: SectionItem): {
  readonly kind: StatusOverviewUnitKind;
  readonly id: string;
} | null {
  if (item.projectId != null) return { kind: "product", id: item.projectId };
  if (item.activityId != null) return { kind: "activity", id: item.activityId };
  return null;
}

export function hasStatusOverviewParent(item: SectionItem): boolean {
  return itemParent(item) != null;
}

function itemStableId(item: SectionItem): string | null {
  return typeof item.stableId === "string" && item.stableId.length > 0
    ? item.stableId
    : null;
}

function toOverviewItem(
  item: SectionItem,
  source: "previous" | "current" | "next",
  index: number,
  priorStableIds: ReadonlySet<string>,
  editable: boolean,
): StatusOverviewItem {
  const stableId = itemStableId(item);
  const recordId = item.id ?? null;
  const wasPreviouslyPlanned = stableId != null && priorStableIds.has(stableId);
  return {
    key: `${source}:${stableId ?? item.id ?? String(index)}`,
    recordId,
    source,
    editTarget:
      editable && recordId != null && source !== "previous"
        ? { recordId, source }
        : null,
    stableId,
    text: item.text,
    tag: item.tag,
    workflowStatus: item.workflowStatus,
    continuity:
      source === "current"
        ? wasPreviouslyPlanned
          ? "continued"
          : "unplanned"
        : null,
  };
}

function itemsForUnit(
  items: readonly SectionItem[],
  type: "current" | "next",
  kind: StatusOverviewUnitKind,
  id: string,
): readonly SectionItem[] {
  return items.filter((item) => {
    const parent = itemParent(item);
    return item.type === type && parent?.kind === kind && parent.id === id;
  });
}

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
    const coveringItems = section.items.filter(
      (item) =>
        item.projectId === project.projectId &&
        item.stageNames.includes(stage.stageName),
    );
    return {
      name: stage.stageName,
      status: deriveEffectiveStageStatus(
        trafficLightToCanonical(stage.status),
        coveringRisks,
        coveringItems,
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
      const parent = itemParent(item);
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
  "name" | "historical" | "status" | "stages" | "linkedProducts"
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
    name: activity?.activityName ?? "Historical activity",
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
  };
}

function buildColumns(
  kind: StatusOverviewUnitKind,
  id: string,
  input: StatusOverviewProjectionSource,
  previous: StatusOverviewSection | null,
): StatusOverviewUnit["columns"] {
  const previousItems = previous
    ? itemsForUnit(previous.items, "next", kind, id)
    : [];
  const priorStableIds = new Set(
    previousItems.flatMap((item) => {
      const stableId = itemStableId(item);
      return stableId == null ? [] : [stableId];
    }),
  );
  const mapItems = (
    items: readonly SectionItem[],
    source: "previous" | "current" | "next",
  ): readonly StatusOverviewItem[] =>
    items.map((item, index) =>
      toOverviewItem(
        item,
        source,
        index,
        priorStableIds,
        input.currentItemsEditable,
      ),
    );
  const previousColumn =
    input.previousPlan.availability === "available"
      ? ({
          availability: "available",
          items: mapItems(previousItems, "previous"),
        } as const)
      : ({
          availability: "unavailable",
          reason: input.previousPlan.reason,
          items: [],
        } as const);
  return {
    previouslyPlanned: previousColumn,
    currentWeek: {
      availability: "available",
      items: mapItems(
        itemsForUnit(input.currentSection.items, "current", kind, id),
        "current",
      ),
    },
    nextWeek: {
      availability: "available",
      items: mapItems(
        itemsForUnit(input.currentSection.items, "next", kind, id),
        "next",
      ),
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
    columns: buildColumns(kind, id, input, previous),
  };
}
