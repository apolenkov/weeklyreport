import { useRef, useState } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
  RecordParent,
} from "../../report-sections";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
  resolveRecordParent,
} from "../../report-sections";
import {
  buildActivityDecisionSave,
  buildDecisionSaveBase,
  buildProductDecisionSave,
  collectDecisionErrors,
  type DecisionFieldErrors,
  resolveDecisionFormSeed,
  resolveDecisionProductName,
} from "./decision-edit-dialog-helpers";

interface UseDecisionEditDialogArgs {
  readonly decision: DecisionEntry | null;
  readonly defaultOwner?: string;
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly products?: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
}

/**
 * All state, derived values and handlers behind the decision dialog's form.
 * Kept out of the component so the dialog file stays render-only.
 */
export function useDecisionEditDialog({
  decision,
  defaultOwner,
  stagesForProduct,
  products,
  activities,
  defaultProductId,
  onSave,
  onCancel,
}: UseDecisionEditDialogArgs) {
  const isCreate = decision === null;

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

  // Seeded once from the bound decision (or create-mode defaults); the parent
  // unmounts this component on close, so no useEffect reset is needed.
  const seed = resolveDecisionFormSeed(decision, defaultOwner);
  const [text, setText] = useState(seed.text);
  // Owner is not user-editable: a decision is always owned by its author — the
  // current lead on create, the saved owner on edit (you only ever open your
  // own decisions; others' are locked). It is persisted but no longer shown as
  // a field — the old read-only input read as editable and was the lone grey
  // box among white inputs.
  const owner = seed.owner;
  const [impact, setImpact] = useState(seed.impact);
  const [deadline, setDeadline] = useState(seed.deadline);
  // activity-first-class: the decision's parent — a product OR an attached
  // activity (XOR). Seeded from the bound row on edit, or the create-mode
  // default product (falling back to the first activity for an activity-only
  // lead with no products). Shared seed rule with the item/risk dialogs.
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      decision ?? {},
      { productId: defaultProductId || products?.[0]?.id },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";
  // unify-record-dialogs: no stage pre-selected on create (mirrors item/risk);
  // edit restores the saved stages. Required + single-owned-stage auto-apply
  // live in handleSave.
  const [stageIds, setStageIds] = useState<string[]>(seed.stageIds);

  // unify-record-dialogs: switching the parent re-scopes the stage options and
  // clears the prior selection, exactly like the item/risk dialogs (never
  // default to all owned stages — W11 3.10). Switching to an activity hides the
  // stage step; switching back to a product re-shows it empty.
  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    setStageIds([]);
  }
  const [errors, setErrors] = useState<DecisionFieldErrors>({});

  const headerVerb = isCreate ? "Add Decision" : "Edit Decision";

  // require-stage-on-items-and-decisions: a PRODUCT-parented decision must carry
  // a concrete stage when the lead owns stages — mirrors the risk/item dialogs. A
  // single owned stage is implicitly selected so the lead can save without a
  // click; zero owned stages with nothing to carry is a dead end (Save disabled).
  // An ACTIVITY-parented decision owns no stage (Decision 5), so the stage step
  // is hidden and never validated.
  const availableStages = isActivityParent
    ? []
    : (stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds);
  const selectedActivity = activities.find((a) => a.id === parent.id);
  const selectedProduct = products?.find((p) => p.id === parent.id);
  const headerProductName = resolveDecisionProductName(
    selectedProduct,
    decision,
  );

  // Moves focus to the first invalid field on a failed save, in the same
  // top-to-bottom order handleSave validates them, so keyboard/AT users land
  // on the problem instead of staying parked on the Save button. Stage
  // errors only ever occur with the multi-choice checkbox group rendered
  // (a single owned stage auto-applies before validation runs), so the
  // checkbox-group query always has a target when reached.
  function focusFirstInvalidField(fieldErrors: DecisionFieldErrors) {
    if (fieldErrors.text) {
      textRef.current?.focus();
    } else if (fieldErrors.impact) {
      impactRef.current?.focus();
    } else if (fieldErrors.stageIds) {
      dialogSurfaceRef.current
        ?.querySelector<HTMLInputElement>(
          '[data-testid="stage-checkbox-group"] input[type="checkbox"]',
        )
        ?.focus();
    }
  }

  function handleSave() {
    // Dead-end no-op: never call onSave with an empty stageIds array, and never
    // surface the unsatisfiable "Select at least one stage." error. The
    // Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (isDeadEnd) return;
    const t = text.trim();
    const o = owner.trim();
    const im = impact.trim();
    const next = collectDecisionErrors({
      text: t,
      impact: im,
      availableStages,
      effectiveStageIds,
    });
    if (Object.keys(next).length > 0) {
      setErrors(next);
      focusFirstInvalidField(next);
      return;
    }
    const base = buildDecisionSaveBase({
      decision,
      text: t,
      owner: o,
      impact: im,
      deadline,
    });
    // activity-first-class: an activity parent yields an activity-parented
    // decision (empty productId, no stage); a product parent keeps today's
    // output. XOR is enforced by the write schema server-side.
    if (isActivityParent) {
      onSave(
        buildActivityDecisionSave({
          base,
          decision,
          selectedActivity,
          activityId: parent.id,
        }),
      );
      return;
    }
    onSave(
      buildProductDecisionSave({
        base,
        decision,
        selectedProduct,
        parentId: parent.id,
        effectiveStageIds,
      }),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return {
    dialogSurfaceRef,
    headerVerb,
    text,
    onTextChange: (v: string) => {
      setText(v);
      setErrors((prev) => ({ ...prev, text: undefined }));
    },
    textError: errors.text,
    textRef,
    deadline,
    onDeadlineChange: setDeadline,
    impact,
    onImpactChange: (v: string) => {
      setImpact(v);
      setErrors((prev) => ({ ...prev, impact: undefined }));
    },
    impactError: errors.impact,
    impactRef,
    parent,
    onParentChange: setParentAndStages,
    isActivityParent,
    stageIds,
    availableStages,
    isDeadEnd,
    stageError: errors.stageIds,
    headerProductName,
    onStageChange: (nextStages: string[]) => {
      setStageIds(nextStages);
      setErrors((prev) => ({ ...prev, stageIds: undefined }));
    },
    handleSave,
    handleKeyDown,
  };
}
