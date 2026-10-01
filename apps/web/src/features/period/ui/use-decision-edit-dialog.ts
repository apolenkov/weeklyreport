import { useRef, useState } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { useDiscardGuard } from "../../../shared/ui/dialogs/use-discard-guard";
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

  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  // Validation-focus targets: on a failed save, focus moves to the first
  // invalid control instead of sitting on the Save button.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const impactRef = useRef<HTMLTextAreaElement>(null);

  const seed = resolveDecisionFormSeed(decision, args.defaultOwner);
  const fields = useDecisionFormState(seed, () => initialDecisionParent(args));
  const snapshot = JSON.stringify([
    fields.text,
    fields.impact,
    fields.deadline,
    fields.parent,
    fields.stageNames,
  ]);
  const [baseline] = useState(snapshot);
  const { requestClose, discardDialog } = useDiscardGuard(
    snapshot !== baseline,
    onCancel,
    args.isPending,
  );
  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  useDialogFocus({
    open: true,
    onClose: requestClose,
    containerRef: dialogSurfaceRef,
  });
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
    headerVerb: decision === null ? "Add decision" : "Edit decision",
    textRef,
    impactRef,
    ...decisionFieldsView(fields),
    isActivityParent: model.isActivityParent,
    availableStages: model.availableStages,
    isDeadEnd: model.isDeadEnd,
    headerProductName: model.headerProductName,
    handleSave,
    handleKeyDown,
    requestClose,
    discardDialog,
  };
}
