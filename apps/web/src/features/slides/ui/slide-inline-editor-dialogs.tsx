"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import { DecisionEditDialog } from "../../period";
import type {
  DecisionEntry,
  KanbanItem,
  RiskEntry,
} from "../../report-sections";
import { ItemEditDialog } from "../../report-sections";
import { RiskEditDialog } from "../../review";
import type {
  ownPeriodRanks,
  SlideInlineEditRecord,
  toDialogActivities,
  toDialogProducts,
  toDialogRisks,
} from "../model/slide-inline-edit";

export type SlideInlineItemRecord = Extract<
  SlideInlineEditRecord,
  { kind: "item" }
>;
export type SlideInlineRiskRecord = Extract<
  SlideInlineEditRecord,
  { kind: "risk" }
>;
export type SlideInlineDecisionRecord = Extract<
  SlideInlineEditRecord,
  { kind: "decision" }
>;

interface SlideInlineEditorDialogsProps {
  readonly isPending: boolean;
  readonly inlineEditRecord: SlideInlineEditRecord | null;
  readonly pendingDeleteRecord: SlideInlineEditRecord | null;
  readonly currentUserName?: string | undefined;
  readonly dialogProducts: ReturnType<typeof toDialogProducts>;
  readonly dialogActivities: ReturnType<typeof toDialogActivities>;
  readonly dialogRanks: ReturnType<typeof ownPeriodRanks>;
  readonly dialogRisks: ReturnType<typeof toDialogRisks>;
  readonly stagesForProduct: (productId: string) => readonly string[];
  readonly onItemSave: (next: KanbanItem) => void;
  readonly onRiskSave: (next: RiskEntry) => void;
  readonly onDecisionSave: (next: DecisionEntry) => void;
  readonly onCancelEdit: () => void;
  readonly onRequestDelete: () => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

export function getActiveItemRecord(
  record: SlideInlineEditRecord | null,
): SlideInlineItemRecord | null {
  return record?.kind === "item" ? record : null;
}

export function getActiveRiskRecord(
  record: SlideInlineEditRecord | null,
): SlideInlineRiskRecord | null {
  return record?.kind === "risk" ? record : null;
}

export function getActiveDecisionRecord(
  record: SlideInlineEditRecord | null,
): SlideInlineDecisionRecord | null {
  return record?.kind === "decision" ? record : null;
}

export function SlideInlineEditorDialogs(props: SlideInlineEditorDialogsProps) {
  const { inlineEditRecord, pendingDeleteRecord } = props;
  // The three edit dialogs differ only in the record they bind; catalogs and
  // cancel/delete wiring are identical for all of them.
  const shared = {
    isPending: props.isPending,
    products: props.dialogProducts,
    activities: props.dialogActivities,
    stagesForProduct: props.stagesForProduct,
    onCancel: props.onCancelEdit,
    onDelete: props.onRequestDelete,
  };
  return (
    <>
      {props.isPending && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed bottom-4 left-1/2 z-[var(--layer-toast)] -translate-x-1/2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-semibold text-[var(--color-foreground)] shadow-lg"
        >
          Saving slide changes…
        </div>
      )}
      <InlineItemDialog
        {...shared}
        record={getActiveItemRecord(inlineEditRecord)}
        currentUserName={props.currentUserName}
        ranks={props.dialogRanks}
        risks={props.dialogRisks}
        onSave={props.onItemSave}
      />
      <InlineRiskDialog
        {...shared}
        record={getActiveRiskRecord(inlineEditRecord)}
        onSave={props.onRiskSave}
      />
      <InlineDecisionDialog
        {...shared}
        record={getActiveDecisionRecord(inlineEditRecord)}
        currentUserName={props.currentUserName}
        onSave={props.onDecisionSave}
      />
      <ConfirmDeleteDialog
        isPending={props.isPending}
        open={pendingDeleteRecord !== null}
        title={pendingDeleteRecord?.deleteTitle ?? "Delete record?"}
        preview={pendingDeleteRecord?.deletePreview ?? ""}
        subtitle={pendingDeleteRecord?.deleteSubtitle}
        onConfirm={props.onConfirmDelete}
        onCancel={props.onCancelDelete}
      />
    </>
  );
}

function InlineItemDialog({
  isPending,
  record,
  currentUserName,
  products,
  activities,
  ranks,
  risks,
  stagesForProduct,
  onSave,
  onCancel,
  onDelete,
}: {
  readonly isPending: boolean;
  readonly record: SlideInlineItemRecord | null;
  readonly currentUserName?: string | undefined;
  readonly products: ReturnType<typeof toDialogProducts>;
  readonly activities: ReturnType<typeof toDialogActivities>;
  readonly ranks: ReturnType<typeof ownPeriodRanks>;
  readonly risks: ReturnType<typeof toDialogRisks>;
  readonly stagesForProduct: (productId: string) => readonly string[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <ItemEditDialog
      isPending={isPending}
      key={record ? `slide-item-${record.ref.stableId}` : "slide-item"}
      open={record !== null}
      item={record?.item ?? null}
      products={products}
      activities={activities}
      week={record?.week ?? "current"}
      currentUserName={currentUserName}
      stagesForProduct={stagesForProduct}
      ownPeriodRanks={ranks}
      risks={risks}
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  );
}

function InlineRiskDialog({
  isPending,
  record,
  products,
  activities,
  stagesForProduct,
  onSave,
  onCancel,
  onDelete,
}: {
  readonly isPending: boolean;
  readonly record: SlideInlineRiskRecord | null;
  readonly products: ReturnType<typeof toDialogProducts>;
  readonly activities: ReturnType<typeof toDialogActivities>;
  readonly stagesForProduct: (productId: string) => readonly string[];
  readonly onSave: (next: RiskEntry) => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <RiskEditDialog
      isPending={isPending}
      key={record ? `slide-risk-${record.ref.stableId}` : "slide-risk"}
      open={record !== null}
      risk={record?.risk ?? null}
      products={products}
      activities={activities}
      stagesForProduct={stagesForProduct}
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  );
}

function InlineDecisionDialog({
  isPending,
  record,
  currentUserName,
  products,
  activities,
  stagesForProduct,
  onSave,
  onCancel,
  onDelete,
}: {
  readonly isPending: boolean;
  readonly record: SlideInlineDecisionRecord | null;
  readonly currentUserName?: string | undefined;
  readonly products: ReturnType<typeof toDialogProducts>;
  readonly activities: ReturnType<typeof toDialogActivities>;
  readonly stagesForProduct: (productId: string) => readonly string[];
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <DecisionEditDialog
      isPending={isPending}
      key={record ? `slide-decision-${record.ref.stableId}` : "slide-decision"}
      open={record !== null}
      decision={record?.decision ?? null}
      defaultOwner={currentUserName}
      stagesForProduct={stagesForProduct}
      products={products}
      activities={activities}
      defaultProductId={products[0]?.id}
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  );
}
