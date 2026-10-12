import type { ActivityLiveRow } from "@weeklyreport/shared";
import { shortNameFromName } from "@weeklyreport/shared";

import type {
  SectionSlideModel,
  SlideReadinessItem,
} from "./section-slide-contracts";
import {
  describeCount,
  NEEDS_WORK_STATUS,
  readinessScore,
  statusTone,
} from "./section-slide-model-helpers";

function activityBaseReadiness(
  row: ActivityLiveRow,
  hasSection: boolean,
  hasContent: boolean,
): readonly SlideReadinessItem[] {
  return [
    {
      id: "scope",
      label: "Scope",
      status: hasSection ? "ready" : NEEDS_WORK_STATUS,
      detail: hasSection ? "Section exists" : "Section not created yet",
      required: true,
    },
    {
      id: "traffic",
      label: "Traffic lights",
      status: hasSection ? NEEDS_WORK_STATUS : "optional",
      detail: hasSection ? "Review product statuses" : "Waiting for section",
      required: hasSection,
    },
    {
      id: "current",
      label: "Current work",
      status: row.itemCount > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        row.itemCount > 0
          ? describeCount(row.itemCount, "item")
          : "No current items yet",
      required: true,
    },
    {
      id: "next",
      label: "Next focus",
      status: hasContent ? NEEDS_WORK_STATUS : "optional",
      detail: hasContent ? "Add next-period focus" : "Waiting for content",
      required: hasContent,
    },
  ];
}

function activityRecordReadiness(
  row: ActivityLiveRow,
): readonly SlideReadinessItem[] {
  return [
    {
      id: "risks",
      label: "Risk story",
      status: row.riskCount > 0 ? "ready" : "optional",
      detail:
        row.riskCount > 0
          ? describeCount(row.riskCount, "risk")
          : "No risks raised",
      required: false,
    },
    {
      id: "priorities",
      label: "Top priorities",
      status: row.priorityCount > 0 ? "ready" : NEEDS_WORK_STATUS,
      detail:
        row.priorityCount > 0
          ? describeCount(row.priorityCount, "priority", "priorities")
          : "No priorities yet",
      required: true,
    },
    {
      id: "decisions",
      label: "Decision context",
      status: row.decisionCount > 0 ? "ready" : "optional",
      detail:
        row.decisionCount > 0
          ? describeCount(row.decisionCount, "decision")
          : "No decision this period",
      required: false,
    },
  ];
}

export function buildActivitySlideModel(
  row: ActivityLiveRow,
): SectionSlideModel {
  const hasSection = row.reportSectionId !== null;
  const hasContent =
    row.itemCount > 0 ||
    row.riskCount > 0 ||
    row.decisionCount > 0 ||
    row.priorityCount > 0;
  const readiness = [
    ...activityBaseReadiness(row, hasSection, hasContent),
    ...activityRecordReadiness(row),
  ];
  const counts = {
    currentCount: row.itemCount,
    nextCount: 0,
    riskCount: row.riskCount,
    priorityCount: row.priorityCount,
    blockedCount: 0,
    atRiskCount: row.riskCount,
  };
  return {
    id: row.reportSectionId ?? row.leadId,
    ownerId: row.leadId,
    ownerName: shortNameFromName(row.leadName),
    ownerRole: "lead",
    status: row.status,
    submittedAt: row.submittedAt,
    products: [],
    productSlides: [],
    productCount: 0,
    ...counts,
    decisionCount: row.decisionCount,
    score: readinessScore(readiness),
    tone: statusTone(counts),
    readiness,
    currentItems: [],
    nextItems: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}
