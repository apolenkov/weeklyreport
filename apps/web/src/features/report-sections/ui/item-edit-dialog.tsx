"use client";

import { createPortal } from "react-dom";

import { RecordDialogFooter } from "../../../shared/ui/record-dialog-footer";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { ItemEditDialogFields } from "./item-edit-dialog-fields";
import { CURRENT_WEEK_CHOICES, NEXT_WEEK_CHOICES } from "./item-status-choices";
import type { ParentActivityOption } from "./product-picker";
import { useItemEditDialog } from "./use-item-edit-dialog";

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
  const d = useItemEditDialog({
    item,
    products,
    activities,
    week,
    currentUserName,
    defaultProductId,
    defaultActivityId,
    stagesForProduct,
    ownPeriodRanks,
    risks,
    onSave,
    onCancel,
  });

  const choices = week === "current" ? CURRENT_WEEK_CHOICES : NEXT_WEEK_CHOICES;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={d.handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to keep clicks inside the dialog from closing it; there is no keyboard action to mirror */}
      <div
        ref={d.dialogSurfaceRef}
        className="w-full max-w-3xl rounded-[var(--radius)] bg-white p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${d.headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {d.headerVerb}{" "}
          {d.parentName ? (
            <span className="text-[var(--color-muted-foreground)]">
              — {d.parentName}
            </span>
          ) : null}
        </h2>

        {/* unify-record-dialogs: two-column layout mirroring the risk dialog —
            prose on the left, a CLASSIFICATION panel (Product + Stages + Status)
            on the right. */}
        <ItemEditDialogFields
          text={d.text}
          onTextChange={d.onTextChange}
          textError={d.textError}
          priorityRank={d.priorityRank}
          onPriorityRankChange={d.onPriorityRankChange}
          rankOptions={d.rankOptions}
          takenRanks={d.takenRanks}
          week={week}
          parent={d.parent}
          products={products}
          activities={activities}
          onParentChange={d.onParentChange}
          isActivityParent={d.isActivityParent}
          stageIds={d.stageIds}
          availableStages={d.availableStages}
          isDeadEnd={d.isDeadEnd}
          stageError={d.stageError}
          parentName={d.parentName}
          onStageChange={d.onStageChange}
          statusSlot={d.statusSlot}
          choices={choices}
          status={d.status}
          onStatusSelect={d.onStatusSelect}
          pausedReason={d.pausedReason}
          pausedReasonError={d.pausedReasonError}
          onPausedReasonChange={d.onPausedReasonChange}
        />

        <RecordDialogFooter
          saveLabel="Save Item"
          onCancel={onCancel}
          onSave={d.handleSave}
          onDelete={onDelete}
          saveDisabled={d.isDeadEnd}
        />
      </div>
    </div>,
    document.body,
  );
}
