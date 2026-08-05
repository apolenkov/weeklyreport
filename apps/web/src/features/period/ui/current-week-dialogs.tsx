"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import type { KanbanItem, Product, RiskEntry } from "../../report-sections";
import { ItemEditDialog } from "../../report-sections";
import { PauseReasonDialog } from "./pause-reason-dialog";

interface CurrentWeekDialogsProps {
  readonly dialogKey: string;
  readonly open: boolean;
  readonly editItem: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities?: readonly { id: string; name: string }[] | undefined;
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
  readonly pausePending: KanbanItem | null;
  readonly onConfirmPause: (reason: string) => void;
  readonly onCancelPause: () => void;
}

// One shared dialog instance across all columns (edit/create, delete, pause).
// Props stay un-destructured: the flat 20-key list is wider than the body.
export function CurrentWeekDialogs(props: CurrentWeekDialogsProps) {
  const { pendingDelete, pausePending } = props;

  return (
    <>
      <ItemEditDialog
        key={props.dialogKey}
        open={props.open}
        item={props.editItem}
        products={props.products}
        activities={props.activities}
        week="current"
        currentUserName={props.currentUserName}
        defaultProductId={props.createSeedProductId}
        defaultActivityId={props.createSeedActivityId}
        stagesForProduct={props.stagesForProduct}
        ownPeriodRanks={props.ownPeriodRanks}
        risks={props.risks}
        onSave={props.onSave}
        onCancel={props.onCancel}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete item?"
        preview={pendingDelete?.text ?? ""}
        subtitle={
          pendingDelete ? `From ${pendingDelete.productName}` : undefined
        }
        onConfirm={props.onConfirmDelete}
        onCancel={props.onCancelDelete}
      />

      <PauseReasonDialog
        open={pausePending !== null}
        preview={pausePending?.text ?? ""}
        initialReason={pausePending?.pausedReason ?? ""}
        onConfirm={props.onConfirmPause}
        onCancel={props.onCancelPause}
      />
    </>
  );
}
