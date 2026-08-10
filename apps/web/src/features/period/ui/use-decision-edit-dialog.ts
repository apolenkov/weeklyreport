import { useRef } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { resolveDecisionFormSeed } from "./decision-edit-dialog-helpers";
import {
  deriveDecisionDialogModel,
  initialDecisionParent,
  type UseDecisionEditDialogArgs,
} from "./decision-edit-dialog-model";
import { runDecisionSave } from "./decision-edit-dialog-save";
import {
  decisionFieldsView,
  useDecisionFormState,
} from "./use-decision-form-state";

export function useDecisionEditDialog(args: UseDecisionEditDialogArgs) {
  const { decision, onCancel } = args;

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });
  // Validation-focus targets: on a failed save, focus moves to the first
  // invalid control instead of sitting on the Save button.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const impactRef = useRef<HTMLTextAreaElement>(null);

  const seed = resolveDecisionFormSeed(decision, args.defaultOwner);
  const fields = useDecisionFormState(seed, () => initialDecisionParent(args));
  const model = deriveDecisionDialogModel(
    args,
    fields.parent,
    fields.stageNames,
  );

  function handleSave() {
    runDecisionSave({
      input: args,
      seed,
      fields,
      model,
      focusTargets: { textRef, impactRef, dialogSurfaceRef },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return {
    dialogSurfaceRef,
    headerVerb: decision === null ? "Add Decision" : "Edit Decision",
    textRef,
    impactRef,
    ...decisionFieldsView(fields),
    isActivityParent: model.isActivityParent,
    availableStages: model.availableStages,
    isDeadEnd: model.isDeadEnd,
    headerProductName: model.headerProductName,
    handleSave,
    handleKeyDown,
  };
}
