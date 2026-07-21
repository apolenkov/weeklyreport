import type { ReportSectionReadModel } from "@customreport/shared";

import { deriveEffectiveStageStatus } from "../../../lib/stage-status";
import { worstTrafficStatus } from "../../../lib/status-presentation";
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
import { buildCrossProductSlide } from "./section-slide-cross-product";
import { nonEmpty, unique } from "./section-slide-model-helpers";

type SectionProject = ReportSectionReadModel["projects"][number];

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

function floorSlideStageStatus(
  status: SlideStageStatus,
  projectRisks: readonly ReportSectionReadModel["risks"][number][],
  stageName: string,
): SlideStageStatus {
  const covering = projectRisks.filter(
    (risk) => nonEmpty(risk.risk) && riskCoversStage(risk, stageName),
  );
  return stageStatusToTraffic(
    deriveEffectiveStageStatus(trafficToStageStatus(status), covering, []),
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
        ? [[item.text.trim(), rank]]
        : [];
    }),
  );
}

function recordSlices(
  section: ReportSectionReadModel,
  projectId: string,
): Omit<SlideProduct, "id" | "name" | "status" | "stages"> {
  const itemTexts = (type: "current" | "next") =>
    section.items
      .filter(
        (item) =>
          item.projectId === projectId &&
          item.type === type &&
          nonEmpty(item.text),
      )
      .map((item) => item.text.trim());
  return {
    currentItems: itemTexts("current"),
    nextItems: itemTexts("next"),
    risks: section.risks
      .filter((risk) => risk.projectId === projectId && nonEmpty(risk.risk))
      .map((risk) => risk.risk.trim()),
    decisions: section.decisions
      .filter(
        (decision) =>
          decision.productId === projectId && nonEmpty(decision.text),
      )
      .map((decision) => decision.text.trim()),
    priorities: section.items
      .filter(
        (item) =>
          item.projectId === projectId &&
          item.priorityRank != null &&
          nonEmpty(item.text),
      )
      .map((item) => item.text.trim()),
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
  const stages: SlideStage[] = [...(project.ownedStages ?? [])]
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
    status: worstTrafficStatus(stages.map((stage) => stage.status)),
    stages,
    ...recordSlices(section, project.projectId),
  };
}

function buildSectionRecordSummary(
  section: ReportSectionReadModel,
): SectionRecordSummary {
  return {
    currentItems: section.items
      .filter(
        (item) =>
          item.type === "current" &&
          item.projectId != null &&
          nonEmpty(item.text),
      )
      .map((item) => item.text.trim()),
    nextItems: section.items
      .filter(
        (item) =>
          item.type === "next" && item.projectId != null && nonEmpty(item.text),
      )
      .map((item) => item.text.trim()),
    risks: section.risks
      .filter((risk) => risk.projectId != null && nonEmpty(risk.risk))
      .map((risk) => risk.risk.trim()),
    decisions: section.decisions
      .filter(
        (decision) => decision.activityId == null && nonEmpty(decision.text),
      )
      .map((decision) => decision.text.trim()),
    priorities: section.items
      .filter(
        (item) =>
          item.priorityRank != null &&
          item.projectId != null &&
          nonEmpty(item.text),
      )
      .map((item) => item.text.trim()),
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
