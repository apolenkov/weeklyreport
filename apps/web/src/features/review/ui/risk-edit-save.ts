import type { RefObject } from "react";

import type { Product, RiskEntry } from "../../report-sections";
import { resolveSaveProduct } from "../../report-sections";
import {
  buildActivityRiskEntry,
  buildProductRiskEntry,
  collectRiskErrors,
  type RiskFieldErrors,
} from "./risk-edit-dialog-helpers";
import type { useRiskEditFields } from "./use-risk-edit-fields";
import type { useRiskEditParentStage } from "./use-risk-edit-parent-stage";

export type RiskEditFields = ReturnType<typeof useRiskEditFields>;
export type RiskEditParentStage = ReturnType<typeof useRiskEditParentStage>;

export interface RiskSaveArgs {
  readonly fields: RiskEditFields;
  readonly parentStage: RiskEditParentStage;
  readonly products: readonly Product[];
  readonly risk: RiskEntry | null;
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly dialogSurfaceRef: RefObject<HTMLDivElement | null>;
}

interface TrimmedProse {
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
}

// Surface every error, then focus the first invalid control. Stage checkboxes
// have no local ref — the dialog surface's only fieldset holds them.
function reportRiskErrors(args: RiskSaveArgs, errors: RiskFieldErrors): void {
  args.fields.setFieldErrors({
    text: errors.text,
    impact: errors.impact,
    mitigation: errors.mitigation,
  });
  args.parentStage.setParentError(errors.parent);
  args.parentStage.setStageError(errors.stageNames);
  if (args.fields.focusFirstInvalid(errors)) return;
  if (errors.parent) {
    args.dialogSurfaceRef.current
      ?.querySelector<HTMLSelectElement>("#risk-product")
      ?.focus();
    return;
  }
  if (errors.stageNames) {
    args.dialogSurfaceRef.current
      ?.querySelector<HTMLInputElement>("fieldset input")
      ?.focus();
  }
}

// An activity parent yields an activity-parented risk (empty productId, no
// stage); a product parent keeps the product + stage shape.
function emitRiskSave(args: RiskSaveArgs, prose: TrimmedProse): void {
  const { parentStage, risk } = args;
  const parentId =
    parentStage.parent.kind === "unresolved"
      ? undefined
      : parentStage.parent.id;
  if (parentStage.isActivityParent) {
    args.onSave(
      buildActivityRiskEntry({
        existingId: risk?.id,
        activityId: parentId ?? "",
        activityName: parentStage.selectedActivity?.name,
        severity: parentStage.severity,
        ...prose,
      }),
    );
    return;
  }
  const product = resolveSaveProduct(args.products, risk, parentId ?? "");
  if (!product) {
    reportRiskErrors(args, { parent: "No product available" });
    return;
  }
  args.onSave(
    buildProductRiskEntry({
      existingId: risk?.id,
      product,
      stageNames: parentStage.effectiveStageNames,
      severity: parentStage.severity,
      ...prose,
    }),
  );
}

// Validate the trimmed fields and emit, or route the errors back to the form.
// The dead-end early return keeps onSave from firing with an empty stageNames
// array, whose "Select at least one stage." error would be unsatisfiable.
export function saveRisk(args: RiskSaveArgs): void {
  const { fields, parentStage } = args;
  if (parentStage.isDeadEnd) return;
  const parentMissing = parentStage.parent.kind === "unresolved";
  const errors = collectRiskErrors({
    text: fields.text,
    impact: fields.impact,
    mitigation: fields.mitigation,
    isActivityParent: parentStage.isActivityParent,
    effectiveStageNames: parentStage.effectiveStageNames,
  });
  if (parentMissing) {
    errors.parent = "No product available";
    delete errors.stageNames;
  }
  if (Object.keys(errors).length > 0) {
    reportRiskErrors(args, errors);
    return;
  }
  const prose: TrimmedProse = {
    text: fields.text.trim(),
    impact: fields.impact.trim(),
    mitigation: fields.mitigation.trim(),
  };
  emitRiskSave(args, prose);
}
