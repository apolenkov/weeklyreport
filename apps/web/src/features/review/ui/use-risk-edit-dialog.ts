import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
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
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly initialImpact?: string | undefined;
  readonly initialMitigation?: string | undefined;
  readonly initialStageNames?: string[] | undefined;
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
    initialImpact: args.initialImpact,
    initialMitigation: args.initialMitigation,
  });

  const parentStage = useRiskEditParentStage({ ...args, isCreate });

  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

  function handleSave() {
    saveRisk({ fields, parentStage, products, risk, onSave, dialogSurfaceRef });
  }

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  useDialogFocus({
    open: true,
    onClose: onCancel,
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
    headerVerb: isCreate ? "Add Risk" : "Edit Risk",
    ...toFieldView(fields),
    ...toParentStageView(parentStage),
    handleSave,
    handleKeyDown,
  };
}
