import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";
import { aggregateTrafficLight } from "@customreport/shared";

import { stageStatusToTraffic } from "../../traffic-light";
import type { Product } from "../../types";

type StageStatusValue = TrafficLightStatus | null;

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
                `${product.id}::${stage.stageName}`,
                stageStatusToTraffic(stage.status),
              ] as const,
            ]
          : [],
      ),
    ),
  );
  const projects = section.projects.map((project) => {
    const ownedStages = project.ownedStages.map((stage) => {
      const key = `${project.projectId}::${stage.stageName}`;
      if (!nextStageStatusByKey.has(key)) return stage;
      return { ...stage, status: nextStageStatusByKey.get(key) ?? null };
    });
    return {
      ...project,
      ownedStages,
      trafficLight: aggregateTrafficLight(
        ownedStages.map((stage) => stage.status),
      ),
    };
  });
  return { ...section, projects };
}
