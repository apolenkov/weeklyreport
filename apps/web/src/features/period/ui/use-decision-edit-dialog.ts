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

// Form state/handlers for the decision dialog; dialog file stays render-only.
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
  // Owner is author-only (create = current lead, edit = saved owner); persisted
  // but not shown — a read-only field looked editable among white inputs.
  const owner = seed.owner;
  const [impact, setImpact] = useState(seed.impact);
  const [deadline, setDeadline] = useState(seed.deadline);
  // Parent is product or activity; seeded from the row (edit) or default
  // product / first activity (create). Shared seed rule with item/risk dialogs.
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      decision ?? {},
      { productId: defaultProductId || products?.[0]?.id },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";
  // Create mode begins without a selected stage, while edit mode restores the
  // saved stages. Required-stage validation and single-stage auto-selection
  // live in handleSave.
  const [stageIds, setStageIds] = useState<string[]>(seed.stageIds);

  // Switching the parent re-scopes the stage options and clears the prior
  // selection rather than selecting every owned stage. An activity hides the
  // stage step; switching back to a product re-shows it empty.
  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    setStageIds([]);
  }
  const [errors, setErrors] = useState<DecisionFieldErrors>({});

  const headerVerb = isCreate ? "Add Decision" : "Edit Decision";

  // Product parents need a concrete stage when the lead owns any; one owned
  // stage auto-selects; zero is a dead end. Activity parents hide stage UI.
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

  // Focus first invalid field top-to-bottom (same order as handleSave). Stage
  // errors only fire when the multi-choice checkbox group is rendered.
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
    // Activity parents produce an empty productId and no stage; product parents
    // retain product and stage data. The write schema enforces the XOR.
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
