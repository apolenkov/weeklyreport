import { useEffect, useRef } from "react";

import type { DraftPatch } from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { overviewAcknowledgedItem } from "./overview-editor-recovery";
import { type UndoTarget, workSignature } from "./overview-undo";
import type { ReadyEditor } from "./use-overview-controller";

interface Offer {
  target: UndoTarget;
  scope: string;
  signature: string;
  reverse: (editor: ReadyEditor) => DraftPatch | null;
  message: string;
}

export function useEntryUndo(
  editor: ReadyEditor | null,
  dialog: OverviewItemDialogState | null,
  announce: (offer: Offer) => void,
) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (
      !editor ||
      dialog?.mode !== "create" ||
      !dialog.submission ||
      previous.current === dialog.submission.token
    )
      return;
    const created = overviewAcknowledgedItem(editor, dialog);
    if (!created) return;
    previous.current = dialog.submission.token;
    const target = { kind: "item" as const, stableId: created.stableId };
    announce({
      target,
      scope: editor.draft.receiptScope,
      signature: workSignature(editor.draft.section, target),
      message: "Entry saved.",
      reverse: (ready) => {
        const items =
          created.week === "current"
            ? ready.view.viewModel.ownCurrentWeekItems
            : ready.view.viewModel.ownNextWeekItems;
        if (!items.some((row) => row.stableId === created.stableId))
          return null;
        return {
          kind: "week-items",
          week: created.week,
          items: items.filter((row) => row.stableId !== created.stableId),
        };
      },
    });
  }, [editor, dialog, announce]);
}
