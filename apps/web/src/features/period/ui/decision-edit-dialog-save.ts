import type { RefObject } from "react";

import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
} from "../../report-sections";
import {
  buildActivityDecisionSave,
  buildDecisionSaveBase,
  buildProductDecisionSave,
  collectDecisionErrors,
  type DecisionFieldErrors,
  type DecisionFormSeed,
} from "./decision-edit-dialog-helpers";
import type {
  DecisionDialogModel,
  UseDecisionEditDialogArgs,
} from "./decision-edit-dialog-model";
import type { DecisionFormState } from "./use-decision-form-state";

export interface DecisionFocusTargets {
  readonly textRef: RefObject<HTMLTextAreaElement | null>;
  readonly impactRef: RefObject<HTMLTextAreaElement | null>;
  readonly dialogSurfaceRef: RefObject<HTMLDivElement | null>;
}

// Assemble and emit the saved row from already-validated fields. Activity
// parents produce an empty productId and no stage; product parents retain
// product and stage data. The write schema enforces the XOR.
function emitDecisionSave(args: {
  readonly decision: DecisionEntry | null;
  readonly text: string;
  readonly owner: string;
  readonly impact: string;
  readonly deadline: string;
  readonly isActivityParent: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly selectedProduct: Product | undefined;
  readonly parentId: string;
  readonly effectiveStageNames: readonly string[];
  readonly onSave: (next: DecisionEntry) => void;
}): void {
  const base = buildDecisionSaveBase({
    decision: args.decision,
    text: args.text,
    owner: args.owner,
    impact: args.impact,
    deadline: args.deadline,
  });
  if (args.isActivityParent) {
    args.onSave(
      buildActivityDecisionSave({
        base,
        decision: args.decision,
        selectedActivity: args.selectedActivity,
        activityId: args.parentId,
      }),
    );
    return;
  }
  args.onSave(
    buildProductDecisionSave({
      base,
      decision: args.decision,
      selectedProduct: args.selectedProduct,
      parentId: args.parentId,
      effectiveStageNames: args.effectiveStageNames,
    }),
  );
}

// Focus first invalid field top-to-bottom (same order the errors are
// collected). Stage errors only fire when the checkbox group is rendered.
function focusFirstInvalidField(
  fieldErrors: DecisionFieldErrors,
  targets: DecisionFocusTargets,
): void {
  if (fieldErrors.text) {
    targets.textRef.current?.focus();
  } else if (fieldErrors.impact) {
    targets.impactRef.current?.focus();
  } else if (fieldErrors.stageNames) {
    targets.dialogSurfaceRef.current
      ?.querySelector<HTMLInputElement>(
        '[data-testid="stage-checkbox-group"] input[type="checkbox"]',
      )
      ?.focus();
  }
}

export function runDecisionSave(args: {
  readonly input: UseDecisionEditDialogArgs;
  readonly seed: DecisionFormSeed;
  readonly fields: DecisionFormState;
  readonly model: DecisionDialogModel;
  readonly focusTargets: DecisionFocusTargets;
}): void {
  // Dead-end no-op: never call onSave with an empty stageNames array, and never
  // surface the unsatisfiable "Select at least one stage." error. The
  // Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
  if (args.model.isDeadEnd) return;
  const text = args.fields.text.trim();
  const impact = args.fields.impact.trim();
  const errors = collectDecisionErrors({
    text,
    impact,
    availableStages: args.model.availableStages,
    effectiveStageNames: args.model.effectiveStageNames,
  });
  if (Object.keys(errors).length > 0) {
    args.fields.setErrors(errors);
    focusFirstInvalidField(errors, args.focusTargets);
    return;
  }
  emitDecisionSave({
    decision: args.input.decision,
    text,
    owner: args.seed.owner.trim(),
    impact,
    deadline: args.fields.deadline,
    isActivityParent: args.model.isActivityParent,
    selectedActivity: args.model.selectedActivity,
    selectedProduct: args.model.selectedProduct,
    parentId:
      args.fields.parent.kind === "unresolved" ? "" : args.fields.parent.id,
    effectiveStageNames: args.model.effectiveStageNames,
    onSave: args.input.onSave,
  });
}
