import { useRef, useState } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { useDiscardGuard } from "../../../shared/ui/dialogs/use-discard-guard";
import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import type { RiskSeverity } from "./risk-edit-dialog-helpers";
import {
  type RiskEditFields,
  type RiskEditParentStage,
  saveRisk,
} from "./risk-edit-save";
import { useRiskEditFields } from "./use-risk-edit-fields";
import { useRiskEditParentStage } from "./use-risk-edit-parent-stage";

interface UseRiskEditDialogArgs {
  readonly risk: RiskEntry | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly onCancel: () => void;
  readonly isPending?: boolean | undefined;
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly initialStageNames?: readonly string[] | undefined;
  readonly initialSeverity?: RiskSeverity | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
}

// The prose fields are exposed verbatim; only the error-routing entry points
// stay internal to the save path.
function toFieldView({
  setFieldErrors,
  focusFirstInvalid,
  ...view
}: RiskEditFields) {
  return view;
}

// Parent/stage state is exposed under the dialog's handler names; the setters
// the save path drives directly stay internal.
function toParentStageView({
  setParentAndStages,
  setSeverity,
  handleStageChange,
  setStageError,
  effectiveStageNames,
  selectedActivity,
  ...view
}: RiskEditParentStage) {
  return {
    ...view,
    onParentChange: setParentAndStages,
    onSeveritySelect: setSeverity,
    onStageChange: handleStageChange,
  };
}

export function useRiskEditDialog(args: UseRiskEditDialogArgs) {
  const { risk, products, onSave, onCancel } = args;
  const isCreate = risk === null;

  const fields = useRiskEditFields({
    initialText: risk?.text ?? "",
    initialImpact: risk?.impact,
    initialMitigation: risk?.mitigation,
  });

  const parentStage = useRiskEditParentStage({ ...args, isCreate });

  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  const snapshot = JSON.stringify([
    fields.text,
    fields.impact,
    fields.mitigation,
    parentStage.parent,
    parentStage.stageNames,
    parentStage.severity,
  ]);
  const [baseline] = useState(snapshot);
  const { requestClose, discardDialog } = useDiscardGuard(
    snapshot !== baseline,
    onCancel,
    args.isPending,
  );

  function handleSave() {
    saveRisk({ fields, parentStage, products, risk, onSave, dialogSurfaceRef });
  }

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  useDialogFocus({
    open: true,
    onClose: requestClose,
    containerRef: dialogSurfaceRef,
  });

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return {
    dialogSurfaceRef,
    headerVerb: isCreate ? "Add risk" : "Edit risk",
    ...toFieldView(fields),
    ...toParentStageView(parentStage),
    handleSave,
    handleKeyDown,
    requestClose,
    discardDialog,
  };
}
