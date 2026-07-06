"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type {
  DecisionEntry,
  Product,
} from "../../report-sections/model/mock-data";
import { resolveRecordParent } from "../../report-sections/model/record-parent";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
} from "../../report-sections/model/stage-ownership";
import { canonicalStageIds } from "../../report-sections/model/stage-tags";
import {
  type ParentActivityOption,
  ParentPicker,
  type RecordParent,
} from "../../report-sections/ui/product-picker";
import { RecordStageStep } from "./record-stage-step";

interface DecisionEditDialogProps {
  readonly open: boolean;
  /** null = create mode, DecisionEntry = edit mode. */
  readonly decision: DecisionEntry | null;
  /**
   * Default owner for newly-created decisions. Should be the current user's
   * display name — leads usually own the decisions they raise.
   */
  readonly defaultOwner?: string;
  /**
   * unify-record-dialogs: SDLC stages owned on the SELECTED product. A decision
   * is now product-scoped like an item/risk — changing the product re-scopes its
   * stage options (it no longer draws from the department-wide union).
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * R4-B: products the lead is assigned to. When more than one, the dialog
   * shows a product picker so the lead can scope the decision to a product.
   */
  readonly products?: readonly Product[];
  /**
   * activity-first-class: the section author's attached activities. When
   * non-empty the parent picker offers them; choosing an activity hides the
   * stage step and parents the decision to the activity instead of a product
   * (Decision 0.4 — parity with the item/risk dialogs).
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
}

/**
 * D12 mount/unmount shell (react-compiler-safe): the outer component returns
 * null when closed and mounts the inner content otherwise. Mount = fresh
 * useState from props; close = unmount. No useEffect reset is needed — the
 * remount is the structural reset, and the parent's openSeq dialogKey forces
 * a fresh mount on every open. This makes the A13 invariant (products /
 * stagesForProduct never read in any deps array) structural.
 */
export function DecisionEditDialog(props: DecisionEditDialogProps) {
  if (!props.open) return null;
  return <DecisionEditDialogContent {...props} />;
}

function DecisionEditDialogContent({
  decision,
  defaultOwner,
  stagesForProduct,
  products,
  activities = [],
  defaultProductId,
  onSave,
  onCancel,
}: DecisionEditDialogProps) {
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

  const [text, setText] = useState(decision?.text ?? "");
  // Owner is not user-editable: a decision is always owned by its author — the
  // current lead on create, the saved owner on edit (you only ever open your
  // own decisions; others' are locked). It is persisted but no longer shown as
  // a field — the old read-only input read as editable and was the lone grey
  // box among white inputs.
  const owner = decision?.owner ?? defaultOwner ?? "";
  const [impact, setImpact] = useState(decision?.impact ?? "");
  const [deadline, setDeadline] = useState(decision?.deadline ?? "");
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
  const [stageIds, setStageIds] = useState<string[]>(
    decision?.stageIds ? [...decision.stageIds] : [],
  );

  // unify-record-dialogs: switching the parent re-scopes the stage options and
  // clears the prior selection, exactly like the item/risk dialogs (never
  // default to all owned stages — W11 3.10). Switching to an activity hides the
  // stage step; switching back to a product re-shows it empty.
  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    setStageIds([]);
  }
  const [errors, setErrors] = useState<{
    text?: string;
    impact?: string;
    stageIds?: string;
  }>({});

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
  const headerProductName =
    products?.find((p) => p.id === parent.id)?.name ??
    decision?.productName ??
    "";

  // Moves focus to the first invalid field on a failed save, in the same
  // top-to-bottom order handleSave validates them, so keyboard/AT users land
  // on the problem instead of staying parked on the Save button. Stage
  // errors only ever occur with the multi-choice checkbox group rendered
  // (a single owned stage auto-applies before validation runs), so the
  // checkbox-group query always has a target when reached.
  function focusFirstInvalidField(fieldErrors: typeof errors) {
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
    const next: typeof errors = {};
    if (t.length === 0) next.text = "Decision text is required";
    if (im.length === 0) next.impact = "Impact is required";
    if (availableStages.length > 0 && effectiveStageIds.length === 0)
      next.stageIds = "Select at least one stage.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      focusFirstInvalidField(next);
      return;
    }
    const base = {
      id: decision?.id ?? crypto.randomUUID(),
      text: t,
      owner: o,
      impact: im,
      deadline: deadline ? deadline : null,
    };
    // activity-first-class: an activity parent yields an activity-parented
    // decision (empty productId, no stage); a product parent keeps today's
    // output. XOR is enforced by the write schema server-side.
    if (isActivityParent) {
      const name = selectedActivity?.name ?? decision?.activityName ?? "";
      onSave({
        ...base,
        productId: "",
        productName: name,
        activityId: parent.id,
        activityName: name,
        stageIds: undefined,
      });
      return;
    }
    const selectedProduct = products?.find((p) => p.id === parent.id);
    onSave({
      ...base,
      productId: parent.id || "",
      productName: selectedProduct?.name ?? decision?.productName ?? "Group",
      activityId: null,
      stageIds:
        effectiveStageIds.length > 0
          ? canonicalStageIds(effectiveStageIds)
          : undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to the backdrop; Escape is handled by the backdrop's onKeyDown which bubbles up */}
      <div
        ref={dialogSurfaceRef}
        className="w-full max-w-3xl rounded-[var(--radius)] bg-white p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}
        </h2>

        {/* unify-record-dialogs: two-column layout mirroring the risk dialog —
            prose on the left, a CLASSIFICATION panel (Product + Stages) on the
            right. A decision carries no status/severity, so the panel is leaner. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
          {/* Left column: decision / deadline / impact prose. */}
          <div className="flex flex-1 flex-col gap-4">
            {/* Decision text */}
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="dec-text"
              >
                Decision *
              </label>
              <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
                The choice you need leadership to make — phrase it as a yes/no
                or short statement, not a discussion topic.
              </p>
              <textarea
                id="dec-text"
                ref={textRef}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
                autoFocus
                aria-invalid={errors.text ? "true" : "false"}
                aria-describedby={errors.text ? "dec-text-error" : undefined}
                className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.text
                    ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
                    : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
                }`}
                style={{ minHeight: "60px" }}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setErrors((prev) => ({ ...prev, text: undefined }));
                }}
                placeholder="e.g. Approve hiring of 2 SDETs in Q3"
              />
              {errors.text && (
                <p
                  id="dec-text-error"
                  role="alert"
                  className="mt-1 text-xs text-[var(--color-destructive)]"
                >
                  {errors.text}
                </p>
              )}
            </div>

            {/* Deadline — Owner is auto-set to the author and no longer shown
                as a field, so Deadline stands on its own row. */}
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="dec-deadline"
              >
                Deadline
              </label>
              <input
                id="dec-deadline"
                type="date"
                className="w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Impact */}
            <div className="flex flex-1 flex-col">
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="dec-impact"
              >
                Impact *
              </label>
              <textarea
                id="dec-impact"
                ref={impactRef}
                aria-invalid={errors.impact ? "true" : "false"}
                aria-describedby={
                  errors.impact ? "dec-impact-error" : undefined
                }
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.impact
                    ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
                    : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
                }`}
                style={{ minHeight: "50px" }}
                value={impact}
                onChange={(e) => {
                  setImpact(e.target.value);
                  setErrors((prev) => ({ ...prev, impact: undefined }));
                }}
                placeholder="What changes when this is decided?"
              />
              {errors.impact && (
                <p
                  id="dec-impact-error"
                  role="alert"
                  className="mt-1 text-xs text-[var(--color-destructive)]"
                >
                  {errors.impact}
                </p>
              )}
            </div>
          </div>

          {/* Right column: CLASSIFICATION panel — Product + Stages. */}
          <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
              Classification
            </span>

            {/* Parent picker — shared component. Offers products and the
                author's attached activities; choosing an activity hides the
                stage step below (an activity owns no SDLC stage). */}
            <ParentPicker
              id="dec-product"
              value={parent}
              products={products ?? []}
              activities={activities}
              onChange={setParentAndStages}
            />

            {/* activity-first-class: the stage step is product-only. */}
            {!isActivityParent && (
              <RecordStageStep
                id="dec-stage"
                stageIds={stageIds}
                availableStages={availableStages}
                isDeadEnd={isDeadEnd}
                error={errors.stageIds}
                parentName={headerProductName}
                onChange={(nextStages) => {
                  setStageIds(nextStages);
                  setErrors((prev) => ({ ...prev, stageIds: undefined }));
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isDeadEnd}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Decision
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
