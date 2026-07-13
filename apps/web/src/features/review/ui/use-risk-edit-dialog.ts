import { useMemo, useRef, useState } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { resolveRecordParent } from "../../report-sections/model/record-parent";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
} from "../../report-sections/model/stage-ownership";
import { canonicalStageIds } from "../../report-sections/model/stage-tags";
import type { Product, RiskEntry } from "../../report-sections/model/types";
import type {
  ParentActivityOption,
  RecordParent,
} from "../../report-sections/ui/product-picker";
import {
  collectRiskErrors,
  computeInitialStageIds,
  computePreCheckedStages,
  deriveFromPreChecked,
  resolveRiskParentName,
  resolveRiskSaveProduct,
  type RiskSeverity,
} from "./risk-edit-dialog-helpers";

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

/**
 * All state, derived values and handlers behind the risk dialog's form. Kept out of the
 * component so the dialog file stays render-only.
 */
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
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk.productId);

  const [text, setText] = useState(risk?.text ?? "");

  // Severity derived ONCE from pipeline on create; user choice is sticky thereafter.
  // Severity is NOT re-derived when the user toggles stage checkboxes.
  // A chip-raise prefill (initialSeverity) wins over the derived default.
  const [severity, setSeverity] = useState<RiskSeverity>(() => {
    if (risk?.severity) return risk.severity;
    if (initialSeverity) return initialSeverity;
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return deriveFromPreChecked(seedProduct, ownedStages);
  });

  // activity-first-class: the record's parent — a product OR an attached
  // activity (XOR). Seeded from the bound risk on edit, else the create-mode
  // seed — a pill raise's activity beats the default product (shared seed
  // rule; falls back to the first activity for an activity-only lead).
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      risk ?? {},
      {
        productId: seedProduct?.id,
        activityId: isCreate ? defaultActivityId : undefined,
      },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";
  const [impact, setImpact] = useState(initialImpact ?? "");
  const [mitigation, setMitigation] = useState(initialMitigation ?? "");

  // Stage checkboxes start empty on create. The user marks stages explicitly.
  // preCheckedStages still renders an info strip (context only), but does not
  // influence initial selection. A chip-raise prefill (initialStageIds)
  // pre-checks the clicked stage.
  const [stageIds, setStageIds] = useState<string[]>(() =>
    computeInitialStageIds(risk, initialStageIds),
  );

  // Per-field error map.
  const [errors, setErrors] = useState<{
    text?: string;
    impact?: string;
    mitigation?: string;
    stageIds?: string;
  }>({});

  // a11y (validation-focus): refs for the three local textareas so a failed
  // save can move focus to the first invalid field instead of stranding it
  // on Save.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const impactRef = useRef<HTMLTextAreaElement>(null);
  const mitigationRef = useRef<HTMLTextAreaElement>(null);

  // Context strip: pipeline stages already flagged that are owned by this lead.
  const preCheckedStages = useMemo(
    () =>
      computePreCheckedStages(
        seedProduct,
        stagesForProduct?.(seedProduct?.id ?? "") ?? [],
      ),
    [seedProduct, stagesForProduct],
  );

  const selectedActivity = activities.find((a) => a.id === parent.id);
  const parentName = resolveRiskParentName({
    isActivityParent,
    selectedActivity,
    products,
    parentId: parent.id,
    risk,
  });
  const headerVerb = isCreate ? "Add Risk" : "Edit Risk";

  function handleStageChange(nextStageIds: string[]) {
    setStageIds(nextStageIds);
    // Clear stageIds error as soon as the user selects something.
    if (nextStageIds.length > 0) {
      setErrors((prev) => ({ ...prev, stageIds: undefined }));
    }
    // Severity is NOT updated here — user's explicit severity choice is sticky.
  }

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // fix-report-surface-integrity: clear the stage selection on any parent
    // switch. NEVER default to all owned stages — that "covers all" default is
    // the root cause of the inflated-completeness ("6/7") defect. Switching to
    // an activity hides the stage step; the lead marks product stages
    // explicitly; the single-owned-stage convenience lives in handleSave.
    setStageIds([]);
  }

  // activity-first-class: the stage step is product-only. An activity owns no
  // SDLC stage (Decision 5), so no stages are available and no dead-end applies.
  const availableStages = isActivityParent
    ? []
    : (stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds);

  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

  /**
   * a11y (validation-focus): moves focus to the first invalid field after a
   * failed save, in the same order the fields are validated, so a keyboard
   * or screen-reader user lands on what needs fixing instead of being left
   * on Save. The stage checkbox group has no local ref of its own — the
   * dialog surface's only `<fieldset>` is StageMultiSelect's, so its first
   * checkbox is reached via a scoped query instead of a wrapper ref.
   */
  function focusFirstInvalidField(fieldErrors: typeof errors) {
    if (fieldErrors.text) {
      textRef.current?.focus();
      return;
    }
    if (fieldErrors.impact) {
      impactRef.current?.focus();
      return;
    }
    if (fieldErrors.mitigation) {
      mitigationRef.current?.focus();
      return;
    }
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
    if (isDeadEnd) return;
    const t = text.trim();
    const im = impact.trim();
    const m = mitigation.trim();
    const next = collectRiskErrors({
      text: t,
      impact: im,
      mitigation: m,
      isActivityParent,
      effectiveStageIds,
    });
    if (Object.keys(next).length > 0) {
      setErrors(next);
      focusFirstInvalidField(next);
      return;
    }
    // activity-first-class: an activity parent yields an activity-parented risk
    // (empty productId, no stage); a product parent keeps today's output.
    if (isActivityParent) {
      onSave({
        id: risk?.id ?? crypto.randomUUID(),
        productId: "",
        productName: selectedActivity?.name ?? "",
        activityId: parent.id,
        activityName: selectedActivity?.name,
        stageIds: [],
        severity,
        text: t,
        impact: im,
        mitigation: m,
      });
      return;
    }
    const product = resolveRiskSaveProduct(products, risk, parent.id);
    if (!product) {
      const noProductError = { text: "No product available" };
      setErrors(noProductError);
      focusFirstInvalidField(noProductError);
      return;
    }
    onSave({
      id: risk?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      activityId: null,
      stageIds: canonicalStageIds(effectiveStageIds),
      severity,
      text: t,
      impact: im,
      mitigation: m,
    });
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
    parentName,
    isActivityParent,
    preCheckedStages,
    text,
    onTextChange: (v: string) => {
      setText(v);
      setErrors((prev) => ({ ...prev, text: undefined }));
    },
    textError: errors.text,
    textRef,
    impact,
    onImpactChange: (v: string) => {
      setImpact(v);
      setErrors((prev) => ({ ...prev, impact: undefined }));
    },
    impactError: errors.impact,
    impactRef,
    mitigation,
    onMitigationChange: (v: string) => {
      setMitigation(v);
      setErrors((prev) => ({ ...prev, mitigation: undefined }));
    },
    mitigationError: errors.mitigation,
    mitigationRef,
    parent,
    onParentChange: setParentAndStages,
    stageIds,
    availableStages,
    severity,
    onSeveritySelect: setSeverity,
    isDeadEnd,
    stageError: errors.stageIds,
    onStageChange: handleStageChange,
    handleSave,
    handleKeyDown,
  };
}
