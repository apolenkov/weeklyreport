import type {
  ItemWorkflowStatus,
  ReportSectionReadModel,
} from "@weeklyreport/shared";

import type {
  ItemStatusInput,
  StatusOverviewItem,
} from "../../../../report-sections";
import {
  buildSetItemStatusPatch,
  itemStatusRiskText,
} from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SourceItem = ReportSectionReadModel["items"][number];
export interface StatusSaveRequest {
  readonly item: StatusOverviewItem;
  readonly status: ItemWorkflowStatus;
  readonly input?: ItemStatusInput;
  readonly commandId?: string;
  readonly onPromotionStart?: () => void;
}

async function planNextStep(
  editor: ReadyEditor,
  source: SourceItem,
  commandId: string,
  onStart: (() => void) | undefined,
): Promise<string | null> {
  if (
    !source.id ||
    !source.stableId ||
    source.type !== "current" ||
    !source.nextStepText?.trim()
  )
    return "This item no longer has a next step to plan. Reload the report.";
  // A stale imported duplicate must never replace an explicit Next winner.
  if (
    editor.draft.section.items.some(
      (row) =>
        row.id !== source.id &&
        row.stableId === source.stableId &&
        row.type === "next",
    )
  )
    return "This item already has a Next plan. Reload the report to use it.";
  if (!editor.outcomes.canExecute)
    return (
      editor.outcomes.blockedReason ?? "Wait for the current update to finish."
    );
  try {
    onStart?.();
    await editor.outcomes.promote(
      { recordId: source.id, commandId, target: "next" },
      source.stableId,
    );
    return null;
  } catch (error_) {
    return error_ instanceof Error
      ? error_.message
      : "The next step could not be planned. Try again.";
  }
}

export async function saveOverviewStatus(
  editor: ReadyEditor,
  {
    item,
    status,
    input = {},
    commandId = crypto.randomUUID(),
    onPromotionStart,
  }: StatusSaveRequest,
): Promise<string | null> {
  if (editor.view.viewModel.isReadOnly)
    return "This report is read-only. Reload the report.";
  const recordId = item.recordId;
  const source =
    typeof recordId === "string"
      ? editor.draft.section.items.find((row) => row.id === recordId)
      : undefined;
  if (
    !source?.id ||
    source.resolution != null ||
    editor.draft.section.status !== "draft"
  )
    return "This update is no longer available. Reload the report.";
  const risk = itemStatusRiskText(editor.draft.section, source);
  if (risk) return `Set by risk: ${risk} — resolve it in Risks & Blockers`;
  if (status === "done" && input.nextStepAction === "plan")
    return planNextStep(editor, source, commandId, onPromotionStart);
  const patch = buildSetItemStatusPatch(
    editor.draft.section,
    source.id,
    status,
    input,
  );
  if (!patch) return "Add the required status input, then try again.";
  editor.draft.apply(patch);
  return null;
}
