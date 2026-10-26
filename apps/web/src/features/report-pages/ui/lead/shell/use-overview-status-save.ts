import type { ItemWorkflowStatus } from "@weeklyreport/shared";

import type {
  ItemStatusInput,
  StatusOverviewItem,
} from "../../../../report-sections";
import { saveOverviewStatus } from "./overview-status-save";
import { useEditorSettle } from "./use-editor-settle";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function useOverviewStatusSave(editor: ReadyEditor | null) {
  const { until, latest } = useEditorSettle(editor);
  return async (
    item: StatusOverviewItem,
    status: ItemWorkflowStatus,
    input: ItemStatusInput = {},
  ): Promise<string | null> => {
    const requested = latest.current;
    if (!requested?.generation)
      return "This update is no longer available. Reload the report.";
    const ready = requested.outcomes.pending
      ? await until((candidate) => !candidate.outcomes.pending)
      : requested;
    if (!ready) return "Wait for the current update to finish, then try again.";
    if (
      ready.generation !== requested.generation ||
      ready.draft.section.authorId !== requested.draft.section.authorId
    )
      return "The report context changed. Reload the report before trying again.";
    const source = ready.draft.section.items.find((row) =>
      item.stableId !== null
        ? row.stableId === item.stableId
        : item.recordId !== null && row.id === item.recordId,
    );
    if (!source?.id)
      return "This update is no longer available. Reload the report.";
    return saveOverviewStatus(ready, {
      item: { ...item, recordId: source.id },
      status,
      input,
    });
  };
}
