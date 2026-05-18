"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PriorityEntry, Product } from "./mock-data";
import { StageMultiSelect } from "./stage-multi-select";

type PriorityEditDialogProps = {
  readonly open: boolean;
  /** Editing an existing row (`null` = create mode). */
  readonly priority: PriorityEntry | null;
  /** Used in the dialog header so the user knows which slot they're filling. */
  readonly nextRank: number;
  /**
   * 35-04 (FEAT-144): SDLC stages available to the lead across all
   * assigned projects. Priorities are department-scoped — same denominator
   * as decisions.
   */
  readonly availableStages?: readonly string[];
  /**
   * R4-B: products the lead is assigned to. When more than one, the dialog
   * shows a product picker so the lead can scope the priority to a product.
   */
  readonly products?: readonly Product[];
  readonly defaultProductId?: string;
  readonly onSave: (next: PriorityEntry) => void;
  readonly onCancel: () => void;
};

/**
 * Single-field modal for adding/editing a priority. Brought online so
 * Item / Risk / Decision / Priority all share the same "open dialog →
 * fill → save" interaction shape — the previous inline-input row
 * felt like an outlier next to the other three. Validation is the
 * same as Risk's: trim() === '' rejects.
 */
export function PriorityEditDialog({
  open,
  priority,
  nextRank,
  availableStages,
  products,
  defaultProductId,
  onSave,
  onCancel,
}: PriorityEditDialogProps) {
  "use no memo";
  const isCreate = priority === null;

  const [text, setText] = useState(priority?.text ?? "");
  const [productId, setProductId] = useState(
    priority?.productId || defaultProductId || products?.[0]?.id || "",
  );
  // UFB-073 (R1): pre-select all owned stages on create; restore existing on edit.
  const [stageIds, setStageIds] = useState<string[]>(
    priority?.stageIds ??
      (isCreate ? (availableStages ? [...availableStages] : []) : []),
  );
  const [errors, setErrors] = useState<{ text?: string }>({});
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // A13 fix: products and availableStages excluded from deps — unstable parent refs
  // (new array/fn each render) cause form-race on autosave → React Query invalidate cycle.
  // Dialog is key-reset by parent on open-transition instead.
  useEffect(() => {
    if (!open) return;
    setText(priority?.text ?? "");
    setProductId(
      priority?.productId || defaultProductId || products?.[0]?.id || "",
    );
    setStageIds(
      priority?.stageIds ??
        (isCreate ? (availableStages ? [...availableStages] : []) : []),
    );
    setErrors({});
    // Focus the input on open. requestAnimationFrame so the portal mount
    // has settled before we steal focus from the underlying overlay.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    priority?.rank,
    priority?.text,
    priority?.stageIds,
    priority?.productId,
    defaultProductId,
    isCreate,
  ]);

  if (!open) return null;

  function handleSave() {
    const trimmed = text.trim();
    const next: typeof errors = {};
    if (trimmed.length === 0) next.text = "Priority text is required";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const selectedProduct = products?.find((p) => p.id === productId);
    onSave({
      rank: priority?.rank ?? nextRank,
      text: trimmed,
      stageIds: stageIds.length > 0 ? stageIds : undefined,
      productId: productId || undefined,
      productName: selectedProduct?.name ?? priority?.productName,
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

  const headerVerb = isCreate ? "Add Priority" : "Edit Priority";
  const slotLabel = isCreate
    ? `Priority ${nextRank}`
    : `Priority ${priority.rank}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-[var(--radius)] bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{" "}
          <span className="text-[var(--color-muted-foreground)]">
            — {slotLabel}
          </span>
        </h2>

        {/* R4-B: product picker — only when the lead owns more than one product */}
        {products && products.length > 1 && (
          <div className="mb-4">
            <label
              className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              htmlFor="priority-product"
            >
              Product
            </label>
            <select
              id="priority-product"
              className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
            htmlFor="priority-text"
          >
            Description *
          </label>
          <textarea
            id="priority-text"
            ref={inputRef}
            aria-invalid={errors.text ? "true" : "false"}
            aria-describedby={errors.text ? "priority-text-error" : undefined}
            className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
              errors.text
                ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
                : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
            }`}
            style={{ minHeight: "70px" }}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setErrors((prev) => ({ ...prev, text: undefined }));
            }}
            placeholder="What matters most to ship this week?"
          />
          {errors.text && (
            <p
              id="priority-text-error"
              className="mt-1 text-xs text-[var(--color-destructive)]"
            >
              {errors.text}
            </p>
          )}
        </div>

        <div className="mt-4">
          <StageMultiSelect
            id="priority-stage"
            value={stageIds}
            stages={availableStages ?? []}
            onChange={setStageIds}
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)]"
            onClick={handleSave}
          >
            Save Priority
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
