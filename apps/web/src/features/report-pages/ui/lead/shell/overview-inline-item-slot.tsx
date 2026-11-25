import type { RefObject } from "react";

import {
  type KanbanItem,
  ownedStagesForProject,
  type StatusOverviewEditorSlot,
  StatusOverviewInlineItemEditor,
  type StatusOverviewModel,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import type { ReadyEditor } from "./use-overview-controller";

interface ItemActions {
  readonly showDetails: () => void;
  readonly dialog: OverviewItemDialogState | null;
  readonly recoveryReason: string | null;
  readonly error: string | null;
  readonly requestCloseRef: RefObject<(() => void) | null>;
  readonly save: (item: KanbanItem) => void;
  readonly saveAndAddAnother: ((item: KanbanItem) => void) | undefined;
  readonly close: () => void;
}

export function overviewInlineItemSlot(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
  actions: ItemActions,
): StatusOverviewEditorSlot | undefined {
  const dialog = actions.dialog;
  if (
    !editor ||
    dialog?.mode !== "create" ||
    !dialog.contextual ||
    dialog.surface === "details" ||
    actions.recoveryReason ||
    editor.generation !== dialog.generation ||
    editor.view.viewModel.isReadOnly
  )
    return undefined;
  const unit = model.units.find(
    (candidate) =>
      candidate.kind === dialog.target.unitKind &&
      candidate.id === dialog.target.unitId &&
      !candidate.historical,
  );
  if (!unit || !actions.saveAndAddAnother) return undefined;
  const view = editor.view.viewModel;
  return {
    mode: "create",
    unitKey: unit.key,
    source: dialog.week,
    recordId: null,
    content: (
      <StatusOverviewInlineItemEditor
        key={`${unit.key}:${dialog.week}:${dialog.seq}`}
        target={{
          kind: "item",
          parent: { kind: unit.kind, id: unit.id, name: unit.name },
          week: dialog.week,
        }}
        onDetails={actions.showDetails}
        products={view.products}
        activities={view.activityOptions}
        stagesForProduct={(id) =>
          ownedStagesForProject(editor.draft.section, id)
        }
        draftStore={dialog.draftStore}
        currentUserName={view.currentUser.name}
        isPending={
          dialog.submission !== null && editor.draft.autosave.state !== "error"
        }
        message={actions.error}
        requestCloseRef={actions.requestCloseRef}
        onSave={actions.save}
        onSaveAndAddAnother={actions.saveAndAddAnother}
        onCancel={actions.close}
      />
    ),
  };
}
