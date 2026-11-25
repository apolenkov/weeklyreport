import type { StatusOverviewItem } from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import type { ReadyEditor } from "./use-overview-controller";
import {
  useOverviewStagesSave,
  useOverviewStatusSave,
} from "./use-overview-status-save";
export function useSetItemStages(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
  dialog: OverviewItemDialogState | null,
) {
  const saveStages = useOverviewStagesSave(editor);
  return (
    item: StatusOverviewItem,
    stageNames: readonly string[],
  ): Promise<string | null> => {
    if (!editor || isReadOnly || dialog || !item.recordId || !item.editTarget)
      return Promise.resolve("This report is not editable right now.");
    return saveStages(item, stageNames);
  };
}

export function useSetItemStatus(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
  dialog: OverviewItemDialogState | null,
) {
  const saveStatus = useOverviewStatusSave(editor);
  return (
    item: StatusOverviewItem,
    status: Parameters<typeof saveStatus>[1],
    _focusKey?: string,
    input: Parameters<typeof saveStatus>[2] = {},
  ): Promise<string | null> => {
    if (!editor || isReadOnly || dialog || !item.recordId || !item.editTarget)
      return Promise.resolve("This report is not editable right now.");
    return saveStatus(item, status, input);
  };
}
