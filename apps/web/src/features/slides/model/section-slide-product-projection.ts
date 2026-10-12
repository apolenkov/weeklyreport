import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { aggregateTrafficLight } from "@weeklyreport/shared";

import { deriveEffectiveStageStatus } from "../../../shared/lib/status/stage-status";
import {
  riskCoversStage,
  stageStatusToTraffic,
  trafficToStageStatus,
} from "../../report-sections";
import type {
  SlideProduct,
  SlideStage,
  SlideStageStatus,
} from "./section-slide-contracts";
import {
  buildCrossProductSlide,
  itemDisplayText,
} from "./section-slide-cross-product";
import { nonEmpty, unique } from "./section-slide-model-helpers";

type SectionProject = ReportSectionReadModel["projects"][number];
type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];

interface SectionRecordSummary {
  readonly currentItems: string[];
  readonly nextItems: string[];
  readonly risks: string[];
  readonly decisions: string[];
  readonly priorities: string[];
}

export interface SectionProductProjection extends SectionRecordSummary {
  readonly products: string[];
  readonly productSlides: SlideProduct[];
}

function itemTexts(
  section: ReportSectionReadModel,
  predicate: (item: SectionItem) => boolean,
): string[] {
  return section.items
    .filter((item) => predicate(item) && nonEmpty(item.text))
    .map(itemDisplayText);
}

function riskTexts(
  section: ReportSectionReadModel,
  predicate: (risk: SectionRisk) => boolean,
): string[] {
  return section.risks
    .filter((risk) => predicate(risk) && nonEmpty(risk.risk))
    .map((risk) => risk.risk.trim());
}

function decisionTexts(
  section: ReportSectionReadModel,
  predicate: (decision: SectionDecision) => boolean,
): string[] {
  return section.decisions
    .filter((decision) => predicate(decision) && nonEmpty(decision.text))
    .map((decision) => decision.text.trim());
}

function floorSlideStageStatus(
  status: SlideStageStatus,
  projectRisks: readonly ReportSectionReadModel["risks"][number][],
  stageName: string,
): SlideStageStatus {
  const covering = projectRisks.filter(
    (risk) => nonEmpty(risk.risk) && riskCoversStage(risk, stageName),
  );
  return stageStatusToTraffic(
    deriveEffectiveStageStatus(trafficToStageStatus(status), covering),
  );
}

function priorityRanks(
  section: ReportSectionReadModel,
  projectId: string,
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    section.items.flatMap<readonly [string, number]>((item) => {
      const rank = item.priorityRank;
      return item.projectId === projectId && rank != null && nonEmpty(item.text)
        ? [[itemDisplayText(item), rank]]
        : [];
    }),
  );
}

function recordSlices(
  section: ReportSectionReadModel,
  projectId: string,
): Omit<SlideProduct, "id" | "name" | "status" | "stages"> {
  return {
    currentItems: itemTexts(
      section,
      (item) => item.projectId === projectId && item.type === "current",
    ),
    nextItems: itemTexts(
      section,
      (item) => item.projectId === projectId && item.type === "next",
    ),
    risks: riskTexts(section, (risk) => risk.projectId === projectId),
    decisions: decisionTexts(
      section,
      (decision) => decision.productId === projectId,
    ),
    priorities: itemTexts(
      section,
      (item) => item.projectId === projectId && item.priorityRank != null,
    ),
    itemRanks: priorityRanks(section, projectId),
  };
}

function buildProductSlide(
  section: ReportSectionReadModel,
  project: SectionProject,
): SlideProduct {
  const projectRisks = section.risks.filter(
    (risk) => risk.projectId === project.projectId,
  );
  const stages: SlideStage[] = [...project.ownedStages]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((stage) => ({
      id: stage.stageId,
      name: stage.stageName,
      status: floorSlideStageStatus(
        stage.status ?? null,
        projectRisks,
        stage.stageName,
      ),
    }));
  return {
    id: project.projectId,
    name: project.projectName,
    status: aggregateTrafficLight(stages.map((stage) => stage.status)),
    stages,
    ...recordSlices(section, project.projectId),
  };
}

function buildSectionRecordSummary(
  section: ReportSectionReadModel,
): SectionRecordSummary {
  return {
    currentItems: itemTexts(section, (item) => item.type === "current"),
    nextItems: itemTexts(section, (item) => item.type === "next"),
    risks: riskTexts(section, () => true),
    decisions: decisionTexts(section, () => true),
    priorities: itemTexts(section, (item) => item.priorityRank != null),
  };
}

export function buildSectionProductProjection(
  section: ReportSectionReadModel,
): SectionProductProjection {
  const projectRows = section.projects.filter(
    (project, index, rows) =>
      rows.findIndex(
        (candidate) => candidate.projectId === project.projectId,
      ) === index,
  );
  const projectIds = new Set(projectRows.map((project) => project.projectId));
  const crossProduct = buildCrossProductSlide(section, projectIds);
  const productSlides = projectRows.map((project) =>
    buildProductSlide(section, project),
  );
  return {
    ...buildSectionRecordSummary(section),
    products: unique(projectRows.map((project) => project.projectName)),
    productSlides:
      crossProduct === null ? productSlides : [...productSlides, crossProduct],
  };
}
