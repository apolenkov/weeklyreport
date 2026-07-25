import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import {
  buildActivityRiskEntry,
  buildProductRiskEntry,
  collectRiskErrors,
  resolveRiskSaveProduct,
  type RiskFieldErrors,
  type RiskSeverity,
} from "./risk-edit-dialog-helpers";
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
  readonly defaultProductId?: string;
  readonly defaultActivityId?: string;
  readonly initialImpact?: string;
  readonly initialMitigation?: string;
  readonly initialStageIds?: string[];
  readonly initialSeverity?: RiskSeverity;
  readonly stagesForProduct?: (productId: string) => readonly string[];
}

export function useRiskEditDialog({
  risk,
  products,
  activities,
  onSave,
  onCancel,
  defaultProductId,
  defaultActivityId,
  initialImpact,
  initialMitigation,
  initialStageIds,
  initialSeverity,
  stagesForProduct,
}: UseRiskEditDialogArgs) {
  const isCreate = risk === null;

  const fields = useRiskEditFields({
    initialText: risk?.text ?? "",
    initialImpact,
    initialMitigation,
  });

  const parentStage = useRiskEditParentStage({
    risk,
    isCreate,
    products,
    activities,
    defaultProductId,
    defaultActivityId,
    initialStageIds,
    initialSeverity,
    stagesForProduct,
  });

  const headerVerb = isCreate ? "Add Risk" : "Edit Risk";

  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

  // After failed save, focus first invalid field. Stage checkboxes have no
  // local ref — query the dialog surface's only fieldset instead.
  function focusFirstInvalidField(fieldErrors: RiskFieldErrors) {
    if (fields.focusFirstInvalid(fieldErrors)) return;
    if (fieldErrors.stageIds) {
      dialogSurfaceRef.current
        ?.querySelector<HTMLInputElement>("fieldset input")
        ?.focus();
    }
  }

  function handleSave() {
    // Early-return no-op so onSave is never called with an empty stageIds array
    // and the unsatisfiable "Select at least one stage." error is never reached.
    // The Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (parentStage.isDeadEnd) return;
    const t = fields.text.trim();
    const im = fields.impact.trim();
    const m = fields.mitigation.trim();
    const next = collectRiskErrors({
      text: t,
      impact: im,
      mitigation: m,
      isActivityParent: parentStage.isActivityParent,
      effectiveStageIds: parentStage.effectiveStageIds,
    });
    if (Object.keys(next).length > 0) {
      fields.setFieldErrors({
        text: next.text,
        impact: next.impact,
        mitigation: next.mitigation,
      });
      parentStage.setStageError(next.stageIds);
      focusFirstInvalidField(next);
      return;
    }
    // An activity parent yields an activity-parented risk (empty productId,
    // no stage); a product parent keeps today's output.
    if (parentStage.isActivityParent) {
      onSave(
        buildActivityRiskEntry({
          existingId: risk?.id,
          activityId: parentStage.parent.id,
          activityName: parentStage.selectedActivity?.name,
          severity: parentStage.severity,
          text: t,
          impact: im,
          mitigation: m,
        }),
      );
      return;
    }
    const product = resolveRiskSaveProduct(
      products,
      risk,
      parentStage.parent.id,
    );
    if (!product) {
      const noProductError = { text: "No product available" };
      fields.setFieldErrors(noProductError);
      parentStage.setStageError(undefined);
      focusFirstInvalidField(noProductError);
      return;
    }
    onSave(
      buildProductRiskEntry({
        existingId: risk?.id,
        product,
        stageIds: parentStage.effectiveStageIds,
        severity: parentStage.severity,
        text: t,
        impact: im,
        mitigation: m,
      }),
    );
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
    headerVerb,
    parentName: parentStage.parentName,
    isActivityParent: parentStage.isActivityParent,
    preCheckedStages: parentStage.preCheckedStages,
    text: fields.text,
    onTextChange: fields.onTextChange,
    textError: fields.textError,
    textRef: fields.textRef,
    impact: fields.impact,
    onImpactChange: fields.onImpactChange,
    impactError: fields.impactError,
    impactRef: fields.impactRef,
    mitigation: fields.mitigation,
    onMitigationChange: fields.onMitigationChange,
    mitigationError: fields.mitigationError,
    mitigationRef: fields.mitigationRef,
    parent: parentStage.parent,
    onParentChange: parentStage.setParentAndStages,
    stageIds: parentStage.stageIds,
    availableStages: parentStage.availableStages,
    severity: parentStage.severity,
    onSeveritySelect: parentStage.setSeverity,
    isDeadEnd: parentStage.isDeadEnd,
    stageError: parentStage.stageError,
    onStageChange: parentStage.handleStageChange,
    handleSave,
    handleKeyDown,
  };
}
