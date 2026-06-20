"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import type { DecisionEntry, Product } from "./mock-data";
import { ProductPicker } from "./product-picker";
import { StageMultiSelect } from "./stage-multi-select";
import { canonicalStageIds } from "./stage-tags";

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
  defaultProductId,
  onSave,
  onCancel,
}: DecisionEditDialogProps) {
  const isCreate = decision === null;

  const [text, setText] = useState(decision?.text ?? "");
  // Owner is not user-editable: a decision is always owned by its author — the
  // current lead on create, the saved owner on edit (you only ever open your
  // own decisions; others' are locked). It is persisted but no longer shown as
  // a field — the old read-only input read as editable and was the lone grey
  // box among white inputs.
  const owner = decision?.owner ?? defaultOwner ?? "";
  const [impact, setImpact] = useState(decision?.impact ?? "");
  const [deadline, setDeadline] = useState(decision?.deadline ?? "");
  const [productId, setProductId] = useState(
    decision?.productId || defaultProductId || products?.[0]?.id || "",
  );
  // unify-record-dialogs: no stage pre-selected on create (mirrors item/risk);
  // edit restores the saved stages. Required + single-owned-stage auto-apply
  // live in handleSave.
  const [stageIds, setStageIds] = useState<string[]>(
    decision?.stageIds ? [...decision.stageIds] : [],
  );

  // unify-record-dialogs: changing the product re-scopes the stage options and
  // clears the prior selection, exactly like the item/risk dialogs (never
  // default to all owned stages — W11 3.10).
  function setProductAndStages(nextProductId: string) {
    setProductId(nextProductId);
    setStageIds([]);
  }
  const [errors, setErrors] = useState<{
    text?: string;
    impact?: string;
    stageIds?: string;
  }>({});

  const headerVerb = isCreate ? "Add Decision" : "Edit Decision";

  function handleSave() {
    const t = text.trim();
    const o = owner.trim();
    const im = impact.trim();
    // require-stage-on-items-and-decisions: a decision must carry a concrete
    // stage when the lead owns stages — mirrors the risk/item dialogs. A single
    // owned stage is implicitly selected so the lead can save without a click.
    const stages = stagesForProduct?.(productId) ?? [];
    const effectiveStageIds =
      stageIds.length === 0 && stages.length === 1 ? [...stages] : stageIds;
    const next: typeof errors = {};
    if (t.length === 0) next.text = "Decision text is required";
    if (im.length === 0) next.impact = "Impact is required";
    if (stages.length > 0 && effectiveStageIds.length === 0)
      next.stageIds = "Select at least one stage.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const selectedProduct = products?.find((p) => p.id === productId);
    onSave({
      id: decision?.id ?? crypto.randomUUID(),
      productId: productId || "",
      productName: selectedProduct?.name ?? decision?.productName ?? "Group",
      text: t,
      owner: o,
      impact: im,
      deadline: deadline ? deadline : null,
      stageIds:
        effectiveStageIds.length > 0
          ? canonicalStageIds(effectiveStageIds)
          : undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
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
        className="w-full max-w-3xl rounded-[var(--radius)] bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
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
                className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
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

            {/* Product picker — shared component, always rendered. */}
            <ProductPicker
              id="dec-product"
              value={productId}
              products={products ?? []}
              onChange={setProductAndStages}
            />

            <StageMultiSelect
              id="dec-stage"
              value={stageIds}
              stages={stagesForProduct?.(productId) ?? []}
              required
              error={errors.stageIds}
              onChange={(next) => {
                setStageIds(next);
                if (errors.stageIds)
                  setErrors((prev) => ({ ...prev, stageIds: undefined }));
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)]"
          >
            Save Decision
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
