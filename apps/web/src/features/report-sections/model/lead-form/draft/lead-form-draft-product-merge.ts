import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import { normalizeStageName } from "../../lead-form";
import { stageStatusToTraffic } from "../../traffic-light";
import type { Product } from "../../types";

type StageStatusValue = TrafficLightStatus | null;

function aggregateTrafficLight(
  stages: readonly { status?: StageStatusValue | undefined }[],
): StageStatusValue {
  if (stages.some((stage) => stage.status === "red")) return "red";
  if (stages.some((stage) => stage.status === "yellow")) return "yellow";
  if (stages.some((stage) => stage.status === "green")) return "green";
  return null;
}

export function mergeProductDraft(
  section: ReportSectionReadModel,
  next: readonly Product[],
): ReportSectionReadModel {
  const nextStageStatusByKey = new Map<string, StageStatusValue>(
    next.flatMap((product) =>
      product.stages.flatMap((stage) =>
        stage.ownership === "mine"
          ? [
              [
                `${product.id}::${normalizeStageName(stage.stageName)}`,
                stageStatusToTraffic(stage.status),
              ] as const,
            ]
          : [],
      ),
    ),
  );
  const projects = section.projects.map((project) => {
    const ownedStages = project.ownedStages.map((stage) => {
      const key = `${project.projectId}::${normalizeStageName(stage.stageName)}`;
      if (!nextStageStatusByKey.has(key)) return stage;
      return { ...stage, status: nextStageStatusByKey.get(key) ?? null };
    });
    return {
      ...project,
      ownedStages,
      trafficLight: aggregateTrafficLight(ownedStages),
    };
  });
  return { ...section, projects };
}
