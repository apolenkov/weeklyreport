"use client";

import { useState } from "react";

import type { ItemStatus, KanbanItem, Product } from "./mock-data";
import { StageMultiSelect } from "./stage-multi-select";

interface ItemEditDialogProps {
  /** Open/close state. Caller controls so it can wire submit/cancel. */
  readonly open: boolean;
  /**
   * The item being edited. When `null` the dialog is in "create" mode and
   * the caller will append the result to the items list. When non-null
   * it's an "edit" mode and the caller upserts by id.
   */
  readonly item: KanbanItem | null;
  /** Available products — required so the user can re-assign the item to another column. */
  readonly products: readonly Product[];
  /**
   * Whether this is the Current Week or Next Week. Only affects which
   * status chips are shown — Next Week doesn't show "Completed" or
   * "Blocked" because those are workflow-state semantics for in-flight
   * work, not yet-to-start work.
   */
  readonly week: "current" | "next";
  /** Author label used as the default for newly-created items. */
  readonly currentUserName?: string;
  /**
   * In create mode, preselect this product. Without it the dialog would
   * default to `products[0]`, which is misleading when the user clicked
   * `+ Add` in a specific column.
   */
  readonly defaultProductId?: string;
  /**
   * 35-04 (FEAT-144): callback returning the SDLC stages the current lead
   * owns on the given project. Constrains the "SDLC Stage" select.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * All priority ranks currently in use by own items for the full period
   * (current + next week combined). The dialog excludes the edited item's
   * own existing rank from this set before marking options as taken, so
   * the user can keep the same rank without seeing it disabled.
   * Legacy rank collisions (multiple items sharing a rank) are handled
   * gracefully — the collision set is visible but the dialog never crashes.
   */
  readonly ownPeriodRanks?: readonly number[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
}

interface Choice {
  value: ItemStatus;
  label: string;
  bg: string;
  color: string;
  border: string;
}

const CURRENT_WEEK_CHOICES: readonly Choice[] = [
  {
    value: "completed",
    label: "✓ Completed",
    bg: "var(--color-primary)",
    color: "#fff",
    border: "var(--color-primary)",
  },
  {
    value: "in-progress",
    label: "! In Progress",
    bg: "var(--color-success)",
    color: "var(--color-primary)",
    border: "var(--color-starbucks-accent)",
  },
  {
    value: "blocked",
    label: "✕ Blocked",
    bg: "#fee2e2",
    color: "var(--color-destructive)",
    border: "var(--color-destructive)",
  },
];

const NEXT_WEEK_CHOICES: readonly Choice[] = [
  {
    value: "planned",
    label: "○ Planned",
    bg: "var(--color-muted)",
    color: "var(--color-muted-foreground)",
    border: "rgba(0,0,0,0.15)",
  },
  {
    value: "in-progress",
    label: "! In Progress",
    bg: "var(--color-success)",
    color: "var(--color-primary)",
    border: "var(--color-starbucks-accent)",
  },
];

/**
 * D12 fix (react-compiler-safe): outer shell conditionally mounts the inner
 * content component. Mount = fresh useState from props; unmount on close.
 * No useEffect reset needed — structural guarantee via mount/unmount.
 *
 * A13 invariant preserved: stagesForProduct is NOT in any deps array.
 * useState initialises once at mount from the stable `initial` snapshot, so
 * parent re-renders with a new stagesForProduct reference don't wipe typed text.
 */
export function ItemEditDialog(props: ItemEditDialogProps) {
  if (!props.open) return null;
  return <ItemEditDialogContent {...props} />;
}

function ItemEditDialogContent({
  open,
  item,
  products,
  week,
  currentUserName,
  defaultProductId,
  stagesForProduct,
  ownPeriodRanks,
  onSave,
  onCancel,
}: ItemEditDialogProps) {
  const isCreate = item === null;

  // Local form state — initialised once at mount from the bound item (or
  // create-mode defaults). The parent unmounts this component on close and
  // mounts a fresh instance on reopen, so state is always in sync with the
  // current item — no useEffect reset required.
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : null;
  const initial: KanbanItem = item ?? {
    id: "",
    productId: seedProduct?.id ?? "",
    productName: seedProduct?.name ?? "",
    status: week === "current" ? "in-progress" : "planned",
    text: "",
    author: currentUserName ?? "You",
  };
  const [text, setText] = useState(initial.text);
  const [status, setStatus] = useState<ItemStatus>(initial.status);
  const [productId, setProductId] = useState(initial.productId);
  const [priorityRank, setPriorityRank] = useState<number | null>(
    item?.priorityRank ?? null,
  );
  // UFB-073 (R1): pre-select all owned stages on create; restore existing on edit.
  const [stageIds, setStageIds] = useState<string[]>(
    item?.stageIds
      ? [...item.stageIds]
      : isCreate
        ? [...(stagesForProduct?.(initial.productId) ?? [])]
        : [],
  );
  const [errors, setErrors] = useState<{ text?: string }>({});

  // Ranks already taken by OTHER items. The item's own current rank is
  // excluded so the user can keep it without seeing a false "taken" marker.
  // Legacy data with duplicate ranks is tolerated: the Set deduplicates.
  const takenRanks = new Set(
    (ownPeriodRanks ?? []).filter((r) => r !== (item?.priorityRank ?? null)),
  );
  // Offer options 1..10 plus any legacy rank above 10 already on the item.
  const MAX_RANK = 10;
  const rankOptions = Array.from({ length: MAX_RANK }, (_, i) => i + 1);
  if (item?.priorityRank != null && item.priorityRank > MAX_RANK) {
    rankOptions.push(item.priorityRank);
  }

  if (!open) return null;

  const choices = week === "current" ? CURRENT_WEEK_CHOICES : NEXT_WEEK_CHOICES;
  const selectedProduct = products.find((p) => p.id === productId);
  const headerProductName = selectedProduct?.name ?? initial.productName;
  const headerVerb = isCreate ? "Add Item" : "Edit Item";

  function setProductAndStages(nextProductId: string) {
    setProductId(nextProductId);
    setStageIds(stagesForProduct ? [...stagesForProduct(nextProductId)] : []);
  }

  function handleSave() {
    const trimmed = text.trim();
    const next: typeof errors = {};
    if (trimmed.length === 0) next.text = "Description is required";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    // Cross-stage rows (fix-lead-surface-name-resolution): an edited item may
    // reference a project outside the lead's stage-owned `products`. Keep the
    // original assignment instead of silently reassigning to the first product.
    const product =
      products.find((p) => p.id === productId) ??
      (item?.productId === productId
        ? { id: item.productId, name: item.productName }
        : products.at(0));
    if (!product) {
      setErrors({ text: "No product available" });
      return;
    }
    const out: KanbanItem = {
      id: item?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      stageIds: stageIds.length > 0 ? stageIds : undefined,
      text: trimmed,
      status,
      author: item?.author ?? currentUserName ?? "You",
      priorityRank: priorityRank ?? null,
    };
    onSave(out);
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to keep clicks inside the dialog from closing it; there is no keyboard action to mirror */}
      <div
        className="w-full max-w-lg rounded-[var(--radius)] bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{" "}
          {headerProductName ? (
            <span className="text-[var(--color-muted-foreground)]">
              — {headerProductName}
            </span>
          ) : null}
        </h2>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              htmlFor="item-text"
            >
              Description *
            </label>
            <textarea
              id="item-text"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
              autoFocus
              aria-invalid={errors.text ? "true" : "false"}
              aria-describedby={errors.text ? "item-text-error" : undefined}
              // Border + focus-ring switch to destructive when validation
              // failed so the error reads at-a-glance, not just from the
              // sentence underneath.
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
              placeholder={
                week === "current"
                  ? "What was done or in progress…"
                  : "What is planned for next week…"
              }
            />
            {errors.text && (
              <p
                id="item-text-error"
                className="mt-1 text-xs text-[var(--color-destructive)]"
              >
                {errors.text}
              </p>
            )}
          </div>

          {/* Priority rank — optional; set to mark this item as a top priority */}
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              htmlFor="item-priority-rank"
            >
              Priority rank{" "}
              <span className="font-normal">
                (optional — leave blank if not a priority)
              </span>
            </label>
            <select
              id="item-priority-rank"
              className="select-chevron w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
              value={priorityRank ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setPriorityRank(v === "" ? null : Number.parseInt(v, 10));
              }}
            >
              <option value="">— none —</option>
              {rankOptions.map((r) => {
                const taken = takenRanks.has(r);
                return (
                  <option key={r} value={r} disabled={taken}>
                    {r}
                    {taken ? " (taken)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <StageMultiSelect
            id="item-stage"
            value={stageIds}
            stages={stagesForProduct?.(productId) ?? []}
            onChange={setStageIds}
          />

          {/* Status chips */}
          <div>
            <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
              Status
            </span>
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => {
                const selected = status === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setStatus(c.value)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,opacity]"
                    style={{
                      background: selected ? c.bg : "transparent",
                      color: selected ? c.color : "var(--color-foreground)",
                      border: `1.5px solid ${selected ? c.border : "rgba(0,0,0,0.15)"}`,
                    }}
                    aria-pressed={selected}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product picker — only meaningful when there are >1 products */}
          {products.length > 1 && (
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="item-product"
              >
                Product
              </label>
              <select
                id="item-product"
                className="select-chevron w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                value={productId}
                onChange={(e) => setProductAndStages(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
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
            Save Item
          </button>
        </div>
      </div>
    </div>
  );
}
