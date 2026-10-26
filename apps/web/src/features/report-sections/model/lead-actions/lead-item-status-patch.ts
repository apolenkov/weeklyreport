import type {
  ItemWorkflowStatus,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { safeText } from "@weeklyreport/shared";

import { coveringRisksForItem } from "../alarms/item-alarm";
import { workflowToItemStatus } from "../item-status";
import type { DraftPatch } from "../lead-form/draft/lead-form-draft-patch";
import { markCompletePatch } from "./lead-item-actions";

export interface ItemStatusInput {
  readonly pausedReason?: string;
  readonly nextStepAction?: "clear";
}

export function itemStatusRiskText(
  section: Pick<ReportSectionReadModel, "risks">,
  item: ReportSectionReadModel["items"][number],
): string | null {
  if (item.projectId == null) return null;
  const risks = coveringRisksForItem(
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
  );
  return risks.length > 0 ? risks.map((risk) => risk.text).join("; ") : null;
}

// Inline input supplements the same guarded draft write. Completing a result
// requires an explicit choice to clear its next step; moving stays separate.
export function buildSetItemStatusPatch(
  section: ReportSectionReadModel,
  itemId: string,
  status: ItemWorkflowStatus,
  input: ItemStatusInput = {},
): DraftPatch | null {
  if (section.status !== "draft") return null;
  const item = section.items.find((candidate) => candidate.id === itemId);
  if (!item || item.resolution != null || itemStatusRiskText(section, item))
    return null;
  const reason = safeText().safeParse(input.pausedReason);
  if (status === "paused" && !reason.success) return null;
  if (
    status === "done" &&
    Boolean(item.nextStepText?.trim()) &&
    input.nextStepAction !== "clear"
  )
    return null;
  return {
    kind: "item-patch",
    itemId,
    patch: {
      ...(status === "done" ? markCompletePatch() : { workflowStatus: status }),
      pausedReason: status === "paused" && reason.success ? reason.data : null,
      ...(item.type === "current" ? { carriedOver: false } : {}),
    },
  };
}
