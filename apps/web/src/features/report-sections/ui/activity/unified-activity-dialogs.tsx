"use client";

import { ConfirmDeleteDialog } from "../../../../shared/ui/dialogs/confirm-delete-dialog";
import type {
  UnifiedActivityEditState,
  UnifiedActivityEntry,
} from "../../model/activity/use-unified-activity-editing";
import type { KanbanItem, Product, RiskEntry } from "../../model/types";
import { ItemEditDialog } from "../item-edit-dialog";

interface UnifiedActivityDialogsProps {
  readonly editState: UnifiedActivityEditState | null;
  readonly pendingDelete: UnifiedActivityEntry | null;
  readonly products: readonly Product[];
  readonly currentUserName?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancelEdit: () => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

export function UnifiedActivityDialogs({
  editState,
  pendingDelete,
  products,
  currentUserName,
  stagesForProduct,
  ownPeriodRanks,
  risks,
  onSave,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
}: UnifiedActivityDialogsProps) {
  return (
    <>
      {/* The EXISTING per-type item dialog; `week` follows the record's
          physical type so the status chips match its storage. */}
      <ItemEditDialog
        key={editState?.seq ?? 0}
        open={editState !== null}
        item={editState?.entry.item ?? null}
        products={products}
        week={editState?.entry.week ?? "current"}
        currentUserName={currentUserName}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={onSave}
        onCancel={onCancelEdit}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete item?"
        preview={pendingDelete?.item.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.item.productName}` : undefined
        }
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
