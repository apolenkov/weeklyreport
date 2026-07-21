"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type { KanbanItem, Product, RiskEntry } from "../../report-sections";
import { ItemEditDialog } from "../../report-sections";

interface NextWeekDialogsProps {
  readonly dialogKey: string;
  readonly open: boolean;
  readonly editItem: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities?: readonly { id: string; name: string }[];
  readonly currentUserName?: string;
  readonly createSeedProductId: string | undefined;
  readonly createSeedActivityId: string | undefined;
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly ownPeriodRanks?: readonly number[];
  readonly risks?: readonly RiskEntry[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly pendingDelete: KanbanItem | null;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

/**
 * Bundles the two modals the Next Week board can show — item edit/create and
 * delete confirmation — as a single instance shared across all columns, so the
 * section only wires state in and callbacks out.
 */
export function NextWeekDialogs({
  dialogKey,
  open,
  editItem,
  products,
  activities,
  currentUserName,
  createSeedProductId,
  createSeedActivityId,
  stagesForProduct,
  ownPeriodRanks,
  risks,
  onSave,
  onCancel,
  pendingDelete,
  onConfirmDelete,
  onCancelDelete,
}: NextWeekDialogsProps) {
  return (
    <>
      <ItemEditDialog
        key={dialogKey}
        open={open}
        item={editItem}
        products={products}
        activities={activities}
        week="next"
        currentUserName={currentUserName}
        defaultProductId={createSeedProductId}
        defaultActivityId={createSeedActivityId}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={onSave}
        onCancel={onCancel}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete next-week item?"
        preview={pendingDelete?.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.productName}` : undefined
        }
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
