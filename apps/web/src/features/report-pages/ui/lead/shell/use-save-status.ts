import { useIsOnline } from "../../../../../shared/lib/query/use-is-online";
import { overviewSaveStatus } from "../chrome/autosave-state-copy";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function useSaveStatus(
  editor: ReadyEditor | null,
  unsavedCount: number,
  outcomePending: boolean,
): string | undefined {
  const online = useIsOnline();
  const ready = editor && !editor.view.viewModel.isReadOnly;
  return overviewSaveStatus({
    outcomePending,
    unsavedCount,
    autosaveState: ready ? editor.draft.autosave.state : null,
    online,
  });
}
