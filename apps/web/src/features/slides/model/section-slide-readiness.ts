import type { ReportSectionReadModel } from "@customreport/shared";

import type { SlideReadinessItem, SlideTone } from "./section-slide-contracts";
import {
  describeCount,
  NEEDS_WORK_STATUS,
  readinessScore,
  statusTone,
} from "./section-slide-model-helpers";
import type { SectionProductProjection } from "./section-slide-product-projection";

export interface SectionSlideHealth {
  readonly blockedCount: number;
  readonly atRiskCount: number;
  readonly score: number;
  readonly tone: SlideTone;
  readonly readiness: SlideReadinessItem[];
}

function scopeReadiness(productCount: number): SlideReadinessItem {
  return {
    id: "scope",
    label: "Scope",
    status: productCount > 0 ? "ready" : NEEDS_WORK_STATUS,
    detail:
      productCount > 0
        ? describeCount(productCount, "product")
        : "No product scope",
    required: true,
  };
}

function trafficReadiness(hasProjectStatuses: boolean): SlideReadinessItem {
  return {
    id: "traffic",
    label: "Traffic lights",
    status: hasProjectStatuses ? "ready" : NEEDS_WORK_STATUS,
    detail: hasProjectStatuses
      ? "Every product has a status"
      : "Add status to every product",
    required: true,
  };
}

function recordReadiness({
  id,
  label,
  count,
  emptyDetail,
}: {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly emptyDetail: string;
}): SlideReadinessItem {
  return {
    id,
    label,
    status: count > 0 ? "ready" : NEEDS_WORK_STATUS,
    detail: count > 0 ? describeCount(count, "item") : emptyDetail,
    required: true,
  };
}

function riskReadiness(
  riskCount: number,
  hasRiskSignal: boolean,
): SlideReadinessItem {
  return {
    id: "risks",
    label: "Risk story",
    status:
      riskCount > 0 ? "ready" : hasRiskSignal ? NEEDS_WORK_STATUS : "optional",
    detail:
      riskCount > 0
        ? describeCount(riskCount, "risk")
        : hasRiskSignal
          ? "Explain the red or yellow signal"
          : "No active risk signal",
    required: hasRiskSignal,
  };
}

function priorityReadiness(priorityCount: number): SlideReadinessItem {
  return {
    id: "priorities",
    label: "Top priorities",
    status: priorityCount > 0 ? "ready" : NEEDS_WORK_STATUS,
    detail:
      priorityCount > 0
        ? describeCount(priorityCount, "priority", "priorities")
        : "Add at least one priority",
    required: true,
  };
}

function decisionReadiness(decisionCount: number): SlideReadinessItem {
  return {
    id: "decisions",
    label: "Decision context",
    status: decisionCount > 0 ? "ready" : "optional",
    detail:
      decisionCount > 0
        ? describeCount(decisionCount, "decision")
        : "No decision this period",
    required: false,
  };
}

// Count projection risk-floored status (status-risk-unification), never raw
// trafficLight — an unbacked red is not shown. Cross-product is status:null.
function statusCounts(
  section: ReportSectionReadModel,
  projection: SectionProductProjection,
) {
  const blockedProjectCount = projection.productSlides.filter(
    (slide) => slide.status === "red",
  ).length;
  const atRiskProjectCount = projection.productSlides.filter(
    (slide) => slide.status === "yellow",
  ).length;
  const blockedRiskCount = section.risks.filter(
    (risk) => risk.severity === "blocked" && risk.projectId != null,
  ).length;
  const atRiskRiskCount = section.risks.filter(
    (risk) => risk.severity === "at-risk" && risk.projectId != null,
  ).length;
  return {
    blockedCount: blockedProjectCount + blockedRiskCount,
    atRiskCount: atRiskProjectCount + atRiskRiskCount,
  };
}

export function buildSectionSlideHealth(
  section: ReportSectionReadModel,
  projection: SectionProductProjection,
): SectionSlideHealth {
  const counts = statusCounts(section, projection);
  const hasProjectStatuses =
    section.projects.length > 0 &&
    section.projects.every((project) => project.trafficLight !== null);
  const hasRiskSignal = counts.blockedCount > 0 || counts.atRiskCount > 0;
  const readiness = [
    scopeReadiness(projection.products.length),
    trafficReadiness(hasProjectStatuses),
    recordReadiness({
      id: "current",
      label: "Current work",
      count: projection.currentItems.length,
      emptyDetail: "Add at least one current item",
    }),
    recordReadiness({
      id: "next",
      label: "Next focus",
      count: projection.nextItems.length,
      emptyDetail: "Add next-period focus",
    }),
    riskReadiness(projection.risks.length, hasRiskSignal),
    priorityReadiness(projection.priorities.length),
    decisionReadiness(projection.decisions.length),
  ];
  const toneCounts = {
    currentCount: projection.currentItems.length,
    nextCount: projection.nextItems.length,
    riskCount: projection.risks.length,
    priorityCount: projection.priorities.length,
    ...counts,
  };
  return {
    ...counts,
    score: readinessScore(readiness),
    tone: statusTone(toneCounts),
    readiness,
  };
}
