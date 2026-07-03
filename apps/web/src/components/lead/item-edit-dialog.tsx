"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../lib/use-dialog-focus";
import type { ItemStatus, KanbanItem, Product } from "./mock-data";
import {
  type ParentActivityOption,
  ParentPicker,
  type RecordParent,
} from "./product-picker";
import { resolveRecordParent } from "./record-parent";
import { RecordStageStep } from "./record-stage-step";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
} from "./stage-ownership";
import { canonicalStageIds } from "./stage-tags";

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
   * activity-first-class: the section author's attached activities. When
   * non-empty the parent picker offers them; choosing an activity hides the
   * stage step and parents the item to the activity instead of a product.
   */
  readonly activities?: readonly ParentActivityOption[];
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

// record-status-derived-from-risk: no free "Blocked" chip. An item's blocked /
// at-risk alarm is DERIVED from a covering risk (the card floors it), never a
// free item status — "set blocked" routes through blocker (risk) creation via
// the quick-add "Blocker" entry. Only progress states are authorable here.
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
 * Per-field validation for the item save. A stage is required only for a
 * product parent with owned stages; an activity owns no stage, so it is never
 * demanded there.
 */
function collectItemErrors(args: {
  readonly trimmed: string;
  readonly isActivityParent: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
}): { text?: string; stageIds?: string } {
  const errors: { text?: string; stageIds?: string } = {};
  if (args.trimmed.length === 0) errors.text = "Description is required";
  if (
    !args.isActivityParent &&
    args.availableStages.length > 0 &&
    args.effectiveStageIds.length === 0
  )
    errors.stageIds = "Select at least one stage.";
  return errors;
}

/**
 * Resolve the product a product-parented save writes to. A cross-stage row may
 * reference a project outside the lead's stage-owned `products`, so keep the
 * original assignment instead of silently reassigning to the first product.
 */
function resolveSaveProduct(
  products: readonly Product[],
  item: KanbanItem | null,
  parentId: string,
): { id: string; name: string } | undefined {
  return (
    products.find((p) => p.id === parentId) ??
    (item?.productId === parentId
      ? { id: item.productId, name: item.productName }
      : products.at(0))
  );
}

// Offer priority ranks 1..10, plus any legacy rank above 10 already on the item.
const MAX_ITEM_RANK = 10;

function buildRankOptions(existingRank: number | null): number[] {
  const base = Array.from({ length: MAX_ITEM_RANK }, (_, i) => i + 1);
  return existingRank != null && existingRank > MAX_ITEM_RANK
    ? [...base, existingRank]
    : base;
}

/** The item status-chip row (Completed / In Progress / Blocked / Planned). */
function ItemStatusChips({
  choices,
  status,
  onSelect,
}: {
  readonly choices: readonly Choice[];
  readonly status: ItemStatus;
  readonly onSelect: (value: ItemStatus) => void;
}) {
  return (
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
              onClick={() => onSelect(c.value)}
              className="inline-flex min-h-[var(--touch-target-min)] md:min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,opacity]"
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
  );
}

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
  activities = [],
  week,
  currentUserName,
  defaultProductId,
  stagesForProduct,
  ownPeriodRanks,
  onSave,
  onCancel,
}: ItemEditDialogProps) {
  const isCreate = item === null;

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });

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
  // record-status-derived-from-risk: a legacy stored `blocked` opens as
  // in-progress — `blocked` is no longer a free item status (the covering risk
  // owns the alarm), so re-saving never re-persists a bare `blocked`.
  const [status, setStatus] = useState<ItemStatus>(
    initial.status === "blocked" ? "in-progress" : initial.status,
  );
  // activity-first-class: the record's parent — a product OR an attached
  // activity (XOR). Seeded from the bound row on edit, or from the create-mode
  // default product (falling back to the first activity for an activity-only
  // lead with no products).
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(initial, undefined, activities),
  );
  const isActivityParent = parent.kind === "activity";
  const [priorityRank, setPriorityRank] = useState<number | null>(
    item?.priorityRank ?? null,
  );
  // unify-record-dialogs: no stage is pre-selected on create — the lead makes an
  // explicit choice (mirrors the risk dialog, which dropped the "all owned
  // stages" default in fix-report-surface-integrity W11). Edit restores the
  // record's saved stages. The required-stage rule + single-owned-stage
  // auto-apply in handleSave still let a one-stage product save without a click.
  const [stageIds, setStageIds] = useState<string[]>(
    item?.stageIds ? [...item.stageIds] : [],
  );
  const [errors, setErrors] = useState<{ text?: string; stageIds?: string }>(
    {},
  );

  // Ranks already taken by OTHER items. The item's own current rank is
  // excluded so the user can keep it without seeing a false "taken" marker.
  // Legacy data with duplicate ranks is tolerated: the Set deduplicates.
  const takenRanks = new Set(
    (ownPeriodRanks ?? []).filter((r) => r !== (item?.priorityRank ?? null)),
  );
  // Offer options 1..10 plus any legacy rank above 10 already on the item.
  const rankOptions = buildRankOptions(item?.priorityRank ?? null);

  if (!open) return null;

  const choices = week === "current" ? CURRENT_WEEK_CHOICES : NEXT_WEEK_CHOICES;
  const selectedActivity = activities.find((a) => a.id === parent.id);
  const selectedProduct = products.find((p) => p.id === parent.id);
  const parentName = isActivityParent
    ? (selectedActivity?.name ?? initial.activityName ?? "")
    : (selectedProduct?.name ?? initial.productName);
  const headerVerb = isCreate ? "Add Item" : "Edit Item";

  // require-stage-on-items-and-decisions: a PRODUCT-parented item must carry a
  // concrete stage when the product has owned stages — mirrors the risk dialog.
  // An ACTIVITY-parented item owns no stage (Decision 5), so the stage step is
  // hidden and never validated.
  const availableStages = isActivityParent
    ? []
    : (stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isDeadEnd =
    !isActivityParent &&
    isZeroOwnedStageDeadEnd(availableStages, effectiveStageIds);

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // Clear the stage selection on any parent switch — never default to all
    // owned stages (mirrors the risk dialog, W11 3.10). Switching to an activity
    // hides the stage step; switching back to a product re-shows it empty. The
    // single-owned-stage convenience still applies at save time.
    setStageIds([]);
  }

  function handleSave() {
    // Dead-end no-op: never call onSave with an empty stageIds array, and never
    // surface the unsatisfiable "Select at least one stage." error. The
    // Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (isDeadEnd) return;
    const trimmed = text.trim();
    const next: typeof errors = collectItemErrors({
      trimmed,
      isActivityParent,
      availableStages,
      effectiveStageIds,
    });
    if (Object.keys(next).length > 0) {
      setErrors(next);
      // Move focus to the first invalid control so the error is discoverable by
      // keyboard/screen-reader users instead of leaving focus on Save.
      const firstInvalid = next.text
        ? document.getElementById("item-text")
        : dialogSurfaceRef.current?.querySelector<HTMLElement>(
            'fieldset input[type="checkbox"]',
          );
      firstInvalid?.focus();
      return;
    }
    // activity-first-class: an activity parent yields an activity-parented row
    // (empty productId, no stage); a product parent keeps today's output.
    if (isActivityParent) {
      onSave({
        id: item?.id ?? crypto.randomUUID(),
        productId: "",
        productName: selectedActivity?.name ?? initial.activityName ?? "",
        activityId: parent.id,
        activityName: selectedActivity?.name ?? initial.activityName,
        text: trimmed,
        status,
        author: item?.author ?? currentUserName ?? "You",
        priorityRank: priorityRank ?? null,
      });
      return;
    }
    const product = resolveSaveProduct(products, item, parent.id);
    if (!product) {
      setErrors({ text: "No product available" });
      return;
    }
    const out: KanbanItem = {
      id: item?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      activityId: null,
      stageIds:
        effectiveStageIds.length > 0
          ? canonicalStageIds(effectiveStageIds)
          : undefined,
      text: trimmed,
      status,
      author: item?.author ?? currentUserName ?? "You",
      priorityRank: priorityRank ?? null,
    };
    onSave(out);
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
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to keep clicks inside the dialog from closing it; there is no keyboard action to mirror */}
      <div
        ref={dialogSurfaceRef}
        className="w-full max-w-3xl rounded-[var(--radius)] bg-white p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{" "}
          {parentName ? (
            <span className="text-[var(--color-muted-foreground)]">
              — {parentName}
            </span>
          ) : null}
        </h2>

        {/* unify-record-dialogs: two-column layout mirroring the risk dialog —
            prose on the left, a CLASSIFICATION panel (Product + Stages + Status)
            on the right. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
          {/* Left column: description + priority rank. */}
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-1 flex-col">
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
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
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
                  role="alert"
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
                className="select-chevron w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white py-2.5 pl-3 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
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
          </div>

          {/* Right column: CLASSIFICATION panel — Product, Stages, Status. */}
          <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
              Classification
            </span>

            {/* Parent picker — shared component. Offers products and the
                author's attached activities; choosing an activity hides the
                stage step below. */}
            <ParentPicker
              id="item-product"
              value={parent}
              products={products}
              activities={activities}
              onChange={setParentAndStages}
            />

            {/* activity-first-class: the stage step is product-only. An activity
                owns no SDLC stage, so it is omitted for an activity parent. */}
            {!isActivityParent && (
              <RecordStageStep
                id="item-stage"
                stageIds={stageIds}
                availableStages={availableStages}
                isDeadEnd={isDeadEnd}
                error={errors.stageIds}
                parentName={parentName}
                onChange={(nextStages) => {
                  setStageIds(nextStages);
                  setErrors((prev) => ({ ...prev, stageIds: undefined }));
                }}
              />
            )}

            <ItemStatusChips
              choices={choices}
              status={status}
              onSelect={setStatus}
            />
          </div>
        </div>

        {/* Footer */}
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
            Save Item
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
