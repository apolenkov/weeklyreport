"use client";

import { ConfirmDeleteDialog } from "../../../../shared/ui/dialogs/confirm-delete-dialog";
import type { UnifiedActivityEntry } from "../../model/activity/unified-activity-entry";
import type { UnifiedActivityEditState } from "../../model/activity/use-unified-activity-editing";
import type { KanbanItem, Product, RiskEntry } from "../../model/types";
import { ItemEditDialog, type ItemEditDialogProps } from "../item-edit-dialog";

interface UnifiedActivityDialogsProps {
  readonly editState: UnifiedActivityEditState | null;
  readonly pendingDelete: UnifiedActivityEntry | null;
  readonly products: readonly Product[];
  readonly activities?: ItemEditDialogProps["activities"];
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
  activities,
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
      {/* `week` follows the record's physical type so the status controls
          match its storage. */}
      <ItemEditDialog
        key={editState?.seq ?? 0}
        open={editState !== null}
        item={editState?.entry.item ?? null}
        products={products}
        activities={activities}
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
