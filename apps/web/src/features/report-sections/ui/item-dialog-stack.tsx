"use client";

import type { ReactNode } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { ItemEditDialog } from "./item-edit-dialog";

export interface ItemDialogStackProps {
  readonly dialogKey: string;
  readonly open: boolean;
  readonly editItem: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities?: readonly { id: string; name: string }[] | undefined;
  readonly week: "current" | "next";
  readonly currentUserName?: string | undefined;
  readonly createSeedProductId: string | undefined;
  readonly createSeedActivityId: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly pendingDelete: KanbanItem | null;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
  readonly pauseDialog?: ReactNode;
}

export function ItemDialogStack({
  dialogKey,
  open,
  editItem,
  products,
  activities,
  week,
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
  pauseDialog,
}: ItemDialogStackProps) {
  return (
    <>
      <ItemEditDialog
        key={dialogKey}
        open={open}
        item={editItem}
        products={products}
        activities={activities}
        week={week}
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
        title={week === "next" ? "Delete next-week item?" : "Delete item?"}
        preview={pendingDelete?.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.productName}` : undefined
        }
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />

      {pauseDialog}
    </>
  );
}
