import type { ItemWorkflowStatus } from "@weeklyreport/shared";

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
interface StatusSaveRequest {
  readonly item: StatusOverviewItem;
  readonly status: ItemWorkflowStatus;
  readonly input?: ItemStatusInput;
}

export function saveOverviewStatus(
  editor: ReadyEditor,
  { item, status, input = {} }: StatusSaveRequest,
): Promise<string | null> {
  if (editor.view.viewModel.isReadOnly)
    return Promise.resolve("This report is read-only. Reload the report.");
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
    return Promise.resolve(
      "This update is no longer available. Reload the report.",
    );
  const risk = itemStatusRiskText(editor.draft.section, source);
  if (risk)
    return Promise.resolve(
      `Set by risk: ${risk} — resolve it in Risks & Blockers`,
    );
  const patch = buildSetItemStatusPatch(
    editor.draft.section,
    source.id,
    status,
    input,
  );
  if (!patch)
    return Promise.resolve("Add the required status input, then try again.");
  editor.draft.apply(patch);
  return Promise.resolve(null);
}
