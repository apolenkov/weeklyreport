import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export interface ActivityWeeklyFieldsChange {
  readonly titleOverride: string | null;
  readonly description: string | null;
}

// Bridges the Overview activity editor to the canonical lead-form draft:
// title and description apply as one patch pair so autosave persists both.
export function buildActivityFieldsChange(editor: ReadyEditor | null) {
  if (!editor) return undefined;
  return (activityId: string, next: ActivityWeeklyFieldsChange): void => {
    editor.view.draftActions.onActivityTitleChange(
      activityId,
      next.titleOverride,
    );
    editor.view.draftActions.onActivityDescriptionChange(
      activityId,
      next.description,
    );
  };
}
