"use client";

import { createPortal } from "react-dom";

import { RecordDialogFooter } from "../../../shared/ui/record-dialog-footer";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { ItemEditDialogFields } from "./item-edit-dialog-fields";
import { CURRENT_WEEK_CHOICES, NEXT_WEEK_CHOICES } from "./item-status-choices";
import type { ParentActivityOption } from "./parent-picker";
import { useItemEditDialog } from "./use-item-edit-dialog";

interface ItemEditDialogProps {
  readonly open: boolean;
  // null = create (append); non-null = edit (upsert by id).
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  // When set, parent picker offers activities; activity parent hides stage step.
  readonly activities?: readonly ParentActivityOption[];
  // Next week omits Completed/Blocked — those are in-flight, not yet-to-start.
  readonly week: "current" | "next";
  readonly currentUserName?: string;
  // Preselect column product; without it create would misleadingly use products[0].
  readonly defaultProductId?: string;
  // Activity-lane create; XOR with defaultProductId.
  readonly defaultActivityId?: string;
  readonly stagesForProduct?: (productId: string) => readonly string[];
  // Ranks in use this period (own item's rank excluded). Collisions stay visible, never crash.
  readonly ownPeriodRanks?: readonly number[];
  // Covering risk floors status chips to a locked message (alarm is risk-derived).
  readonly risks?: readonly RiskEntry[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
}

// Mount/unmount resets state (react-compiler-safe). stagesForProduct is not in
// deps — useState seeds once from the mount snapshot so parent re-renders
// with a new stagesForProduct ref never wipe typed text.
export function ItemEditDialog({ open, ...rest }: ItemEditDialogProps) {
  if (!open) return null;
  return <ItemEditDialogContent {...rest} />;
}

type ItemEditDialogContentProps = Omit<ItemEditDialogProps, "open">;

function ItemEditDialogHeading({
  headerVerb,
  parentName,
}: {
  readonly headerVerb: string;
  readonly parentName: string;
}) {
  return (
    <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
      {headerVerb}{" "}
      {parentName ? (
        <span className="text-[var(--color-muted-foreground)]">
          — {parentName}
        </span>
      ) : null}
    </h2>
  );
}

function ItemEditDialogContent(props: ItemEditDialogContentProps) {
  const { activities = [], products, week, onCancel, onDelete } = props;
  const { dialogSurfaceRef, handleKeyDown, handleSave, headerVerb, ...fields } =
    useItemEditDialog({ ...props, activities });

  const choices = week === "current" ? CURRENT_WEEK_CHOICES : NEXT_WEEK_CHOICES;

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
        <ItemEditDialogHeading
          headerVerb={headerVerb}
          parentName={fields.parentName}
        />

        <ItemEditDialogFields
          {...fields}
          week={week}
          products={products}
          activities={activities}
          choices={choices}
        />

        <RecordDialogFooter
          saveLabel="Save Item"
          onCancel={onCancel}
          onSave={handleSave}
          onDelete={onDelete}
          saveDisabled={fields.isDeadEnd}
        />
      </div>
    </div>,
    document.body,
  );
}
