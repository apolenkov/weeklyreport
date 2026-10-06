import type {
  ItemWorkflowStatus,
  ReportSectionReadModel,
} from "@customreport/shared";

import { deriveItemAlarmFromRisks } from "../alarms/item-alarm";
import { workflowToItemStatus } from "../item-status";
import type { DraftPatch } from "../lead-form/draft/lead-form-draft-patch";

// Direct status change from the Overview status menu. Returns null when the
// choice needs the canonical editor instead: a pause needs its reason, a
// completed item cannot keep a next step, and a covering risk owns the alarm
// of an in-progress item. Choosing a status also confirms a carried item.
export function buildSetItemStatusPatch(
  section: ReportSectionReadModel,
  itemId: string,
  status: ItemWorkflowStatus,
): DraftPatch | null {
  if (section.status !== "draft") return null;
  const item = section.items.find((candidate) => candidate.id === itemId);
  if (!item || item.resolution != null || status === "paused") return null;
  if (status === "done" && Boolean(item.nextStepText?.trim())) return null;
  const covered =
    item.projectId != null &&
    deriveItemAlarmFromRisks(
      {
        productId: item.projectId,
        stageNames: item.stageNames,
        status: workflowToItemStatus(item.workflowStatus),
      },
      section.risks.map((risk) => ({
        productId: risk.projectId ?? "",
        stageNames: risk.stageNames,
        severity: risk.severity,
        text: risk.risk,
      })),
    ) !== null;
  if (covered) return null;
  return {
    kind: "item-patch",
    itemId,
    patch: {
      workflowStatus: status,
      pausedReason: null,
      ...(item.type === "current" ? { carriedOver: false } : {}),
    },
  };
}
