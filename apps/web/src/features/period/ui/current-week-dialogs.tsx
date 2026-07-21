"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type { KanbanItem, Product, RiskEntry } from "../../report-sections";
import { ItemEditDialog } from "../../report-sections";
import { PauseReasonDialog } from "./pause-reason-dialog";

interface CurrentWeekDialogsProps {
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
  readonly pausePending: KanbanItem | null;
  readonly onConfirmPause: (reason: string) => void;
  readonly onCancelPause: () => void;
}

/**
 * Bundles the three modals the Current Week board can show — item edit/create,
 * delete confirmation, pause reason — as a single instance shared across all
 * columns, so the section only wires state in and callbacks out.
 */
export function CurrentWeekDialogs({
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
  pausePending,
  onConfirmPause,
  onCancelPause,
}: CurrentWeekDialogsProps) {
  return (
    <>
      <ItemEditDialog
        key={dialogKey}
        open={open}
        item={editItem}
        products={products}
        activities={activities}
        week="current"
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
        title="Delete item?"
        preview={pendingDelete?.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.productName}` : undefined
        }
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />

      <PauseReasonDialog
        open={pausePending !== null}
        preview={pausePending?.text ?? ""}
        initialReason={pausePending?.pausedReason ?? ""}
        onConfirm={onConfirmPause}
        onCancel={onCancelPause}
      />
    </>
  );
}
