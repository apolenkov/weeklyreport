"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { deriveItemAlarmFromRisks } from "../../../lib/item-alarm";
import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { RecordDialogFooter } from "../../../shared/ui/record-dialog-footer";
import { RecordStageStep } from "../../period/ui/record-stage-step";
import type {
  ItemStatus,
  KanbanItem,
  Product,
  RiskEntry,
} from "../model/mock-data";
import { resolveRecordParent } from "../model/record-parent";
import {
  computeEffectiveStageIds,
  isZeroOwnedStageDeadEnd,
} from "../model/stage-ownership";
import { canonicalStageIds } from "../model/stage-tags";
import {
  type ParentActivityOption,
  ParentPicker,
  type RecordParent,
} from "./product-picker";

/** The prefill an item's alarm gesture hands to blocker (risk) creation. */
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
   * In create mode, preselect this activity as the parent — an activity
   * lane's `+ Add`. Wins over the seed product (XOR parent).
   */
  readonly defaultActivityId?: string;
  /**
   * Callback returning the SDLC stages the current lead owns on the given
   * project. Constrains the "SDLC Stage" select.
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
  /**
   * The section's own risks. An item a covering risk floors shows an inline
   * locked message in place of the status chips (its at-risk/blocked alarm is
   * derived from the risk, never a free chip — record-status-derived-from-risk).
   */
  readonly risks?: readonly RiskEntry[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
}

interface Choice {
  value: ItemStatus;
  label: string;
  bg: string;
  color: string;
  border: string;
}

const CSS_PRIMARY = "var(--color-primary)";
const IN_PROGRESS_STATUS = "in-progress";
// Shared quiet-chip palette for the not-in-flight states.
const CSS_MUTED = "var(--color-muted)";
const CSS_MUTED_FG = "var(--color-muted-foreground)";
const CHIP_IDLE_BORDER = "rgba(0,0,0,0.15)";

// record-status-derived-from-risk: no free "Blocked" chip and no in-dialog
// blocker gesture. An item's blocked / at-risk alarm is DERIVED from a
// covering risk, never a free item status — a blocker is created in Risks &
// Blockers (or the quick-add "Blocker" entry). Each item type authors only
// its own progress vocabulary (rework-item-status-model).
const CURRENT_WEEK_CHOICES: readonly Choice[] = [
  {
    value: IN_PROGRESS_STATUS,
    label: "! In Progress",
    bg: "var(--color-success)",
    color: CSS_PRIMARY,
    border: "var(--color-starbucks-accent)",
  },
  {
    value: "paused",
    label: "‖ Paused",
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: "completed",
    label: "✓ Completed",
    bg: CSS_PRIMARY,
    color: "#fff",
    border: CSS_PRIMARY,
  },
];

const NEXT_WEEK_CHOICES: readonly Choice[] = [
  {
    value: "planned",
    label: "○ Planned",
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
  },
  {
    value: "postponed",
    label: "» Postponed",
    bg: CSS_MUTED,
    color: CSS_MUTED_FG,
    border: CHIP_IDLE_BORDER,
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
 * The first invalid control in DOM order — text, then the stage fieldset,
 * then the paused-reason field. A later error must never steal focus past an
 * earlier one (a pausedReason error does not outrank a missing stage).
 */
function firstInvalidControl(
  next: { text?: string; stageIds?: string; pausedReason?: string },
  surface: HTMLElement | null,
): HTMLElement | null {
  if (next.text) return document.getElementById("item-text");
  if (next.stageIds) {
    return (
      surface?.querySelector<HTMLElement>('fieldset input[type="checkbox"]') ??
      null
    );
  }
  if (next.pausedReason) return document.getElementById("item-paused-reason");
  return null;
}

interface CoverageArgs {
  readonly isActivityParent: boolean;
  readonly productId: string;
  readonly stageIds: readonly string[];
  readonly status: ItemStatus;
  readonly risks: readonly RiskEntry[] | undefined;
}

/**
 * Whether a covering risk floors the item in its LIVE edit state. `status` is
 * already coerced (a stored blocked opens as in-progress), so this floors to the
 * risk's severity exactly as the card does. Product parents with a concrete
 * stage only — an activity item's severity stays isolated, and a stage-less row
 * (a fresh create before a stage is picked) is never pre-locked by the wildcard.
 */
function isItemCovered(args: CoverageArgs): boolean {
  if (args.isActivityParent || args.productId === "") return false;
  if (args.stageIds.length === 0) return false;
  return (
    deriveItemAlarmFromRisks(
      {
        productId: args.productId,
        stageIds: args.stageIds,
        status: args.status,
      },
      args.risks ?? [],
    ) !== null
  );
}

type StatusSlot = "locked" | "chips";

/**
 * The status slot to render: `locked` (a covering risk owns the alarm) or the
 * per-type progress `chips`. No in-dialog blocker gesture exists — blockers
 * are created in Risks & Blockers (rework-item-status-model).
 */
function resolveStatusSlot(args: CoverageArgs): StatusSlot {
  return isItemCovered(args) ? "locked" : "chips";
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
                border: `1.5px solid ${selected ? c.border : CHIP_IDLE_BORDER}`,
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
 * require-paused-item-reason: the reason field shown when Paused is the selected
 * status. Extracted so the dialog's conditional render stays flat (cognitive
 * complexity). Required — the parent blocks save while it is empty.
 */
function PausedReasonField({
  value,
  error,
  onChange,
}: {
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (next: string) => void;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor="item-paused-reason"
      >
        Pause reason *
      </label>
      <textarea
        id="item-paused-reason"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "item-paused-reason-error" : undefined}
        className={`w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none ${
          error
            ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
            : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
        }`}
        style={{ minHeight: "52px" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Why is this paused? (e.g. waiting on a dependency)"
      />
      {error && (
        <p
          id="item-paused-reason-error"
          role="alert"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The status slot when a covering risk floors the item: the alarm is derived
 * from that risk, so the free chips are replaced by a read-only lock message.
 */
function CoveredStatusLock() {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        Status
      </span>
      <p className="rounded-xl border border-[rgba(200,32,20,0.15)] bg-[var(--color-status-blocked-bg)] px-3 py-2 text-xs text-[var(--color-foreground)]">
        Status is set by the covering risk/blocker — resolve it in Risks &amp;
        Blockers to change.
      </p>
    </div>
  );
}

/** The status slot: the locked message, or the progress chips. The former
 * in-dialog "mark as blocked" gesture is gone — blockers live in Risks &
 * Blockers (rework-item-status-model). */
function StatusSlotView({
  slot,
  choices,
  status,
  onSelect,
}: {
  readonly slot: StatusSlot;
  readonly choices: readonly Choice[];
  readonly status: ItemStatus;
  readonly onSelect: (value: ItemStatus) => void;
}) {
  if (slot === "locked") return <CoveredStatusLock />;
  return (
    <div className="flex flex-col">
      <ItemStatusChips choices={choices} status={status} onSelect={onSelect} />
    </div>
  );
}

/**
 * react-compiler-safe: outer shell conditionally mounts the inner content
 * component. Mount = fresh useState from props; unmount on close. No useEffect
 * reset needed — structural guarantee via mount/unmount.
 *
 * Invariant: stagesForProduct is NOT in any deps array. useState initialises
 * once at mount from the stable `initial` snapshot, so parent re-renders with a
 * new stagesForProduct reference don't wipe typed text.
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
  defaultActivityId,
  stagesForProduct,
  ownPeriodRanks,
  risks,
  onSave,
  onCancel,
  onDelete,
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
    status: week === "current" ? IN_PROGRESS_STATUS : "planned",
    text: "",
    author: currentUserName ?? "You",
  };
  const [text, setText] = useState(initial.text);
  // record-status-derived-from-risk: a legacy stored `blocked` opens as
  // in-progress — `blocked` is no longer a free item status (the covering risk
  // owns the alarm), so re-saving never re-persists a bare `blocked`.
  const [status, setStatus] = useState<ItemStatus>(
    initial.status === "blocked" ? IN_PROGRESS_STATUS : initial.status,
  );
  // require-paused-item-reason: seeded from the bound row so editing a paused
  // item preserves its reason instead of silently wiping it; required only
  // while Paused is the selected status.
  const [pausedReason, setPausedReason] = useState(item?.pausedReason ?? "");
  // activity-first-class: the record's parent — a product OR an attached
  // activity (XOR). Seeded from the bound row on edit, or from the create-mode
  // seed — an activity lane's `+ Add` presets the activity and beats the
  // baked-in seed product (falling back to the first activity for an
  // activity-only lead with no products).
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      initial,
      { activityId: isCreate ? defaultActivityId : undefined },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";
  const [priorityRank, setPriorityRank] = useState<number | null>(
    item?.priorityRank ?? null,
  );
  // unify-record-dialogs: no stage is pre-selected on create — the lead makes an
  // explicit choice (mirrors the risk dialog's no "all owned stages" default).
  // Edit restores the record's saved stages. The required-stage rule +
  // single-owned-stage auto-apply in handleSave still let a one-stage product
  // save without a click.
  const [stageIds, setStageIds] = useState<string[]>(
    item?.stageIds ? [...item.stageIds] : [],
  );
  const [errors, setErrors] = useState<{
    text?: string;
    stageIds?: string;
    pausedReason?: string;
  }>({});

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

  const statusSlot = resolveStatusSlot({
    isActivityParent,
    productId: parent.id,
    stageIds: effectiveStageIds,
    status,
    risks,
  });

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // Clear the stage selection on any parent switch — never default to all
    // owned stages (mirrors the risk dialog). Switching to an activity hides the
    // stage step; switching back to a product re-shows it empty. The
    // single-owned-stage convenience still applies at save time.
    setStageIds([]);
  }

  function handleSave() {
    // Dead-end no-op: never call onSave with an empty stageIds array, and never
    // surface the unsatisfiable "Select at least one stage." error. The
    // Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (isDeadEnd) return;
    const trimmed = text.trim();
    const trimmedPausedReason = pausedReason.trim();
    const next: typeof errors = collectItemErrors({
      trimmed,
      isActivityParent,
      availableStages,
      effectiveStageIds,
    });
    // require-paused-item-reason: a Paused item must carry a reason.
    if (status === "paused" && trimmedPausedReason.length === 0) {
      next.pausedReason = "A reason is required to pause an item.";
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      // Move focus to the first invalid control so the error is discoverable
      // by keyboard/screen-reader users instead of leaving focus on Save.
      firstInvalidControl(next, dialogSurfaceRef.current)?.focus();
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
        pausedReason: status === "paused" ? trimmedPausedReason : null,
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
      pausedReason: status === "paused" ? trimmedPausedReason : null,
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

            <StatusSlotView
              slot={statusSlot}
              choices={choices}
              status={status}
              onSelect={setStatus}
            />

            {/* require-paused-item-reason: a Paused item must explain why. */}
            {status === "paused" && (
              <PausedReasonField
                value={pausedReason}
                error={errors.pausedReason}
                onChange={(next) => {
                  setPausedReason(next);
                  setErrors((prev) => ({ ...prev, pausedReason: undefined }));
                }}
              />
            )}
          </div>
        </div>

        <RecordDialogFooter
          saveLabel="Save Item"
          onCancel={onCancel}
          onSave={handleSave}
          onDelete={onDelete}
          saveDisabled={isDeadEnd}
        />
      </div>
    </div>,
    document.body,
  );
}
