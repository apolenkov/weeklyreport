import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@weeklyreport/shared";
import { aggregateTrafficLight } from "@weeklyreport/shared";

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
      const status = nextStageStatusByKey.get(key) ?? null;
      if (status === stage.status) return stage;
      return { ...stage, status };
    });
    return {
      ...project,
      ownedStages,
      trafficLight: ownedStages.some(
        (stage, index) => stage !== project.ownedStages[index],
      )
        ? aggregateTrafficLight(ownedStages.map((stage) => stage.status))
        : project.trafficLight,
    };
  });
  return { ...section, projects };
}
