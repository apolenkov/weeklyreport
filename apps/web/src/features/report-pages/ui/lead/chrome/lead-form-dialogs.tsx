"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { type ComponentProps, useEffect, useReducer, useRef } from "react";

import { useEditableListDialog } from "../../../../../shared/hooks/dialogs/use-editable-list-dialog";
import { ConfirmDeleteDialog } from "../../../../../shared/ui/dialogs/confirm-delete-dialog";
import { ConfirmationDialog } from "../../../../../shared/ui/dialogs/confirmation-dialog";
import { DecisionEditDialog, RequestReopenDialog } from "../../../../period";
import type {
  DecisionEntry,
  LeadFormLoadedViewModel,
  RiskEntry,
  RiskPrefillRequest,
} from "../../../../report-sections";
import {
  ItemEditDialog,
  type KanbanItem,
  ownedStagesForProject,
} from "../../../../report-sections";
import type { QuickAddItem } from "../../../../report-sections/client";
import { RiskEditDialog } from "../../../../review";
import { SubmitConfirmDialog } from "./submit-confirm-dialog";

export interface LeadFormDialogsQuickAdd {
  readonly quickAddItem: QuickAddItem | null;
  readonly onQuickAddSave: (item: KanbanItem) => void;
  readonly onQuickAddCancel: () => void;
  readonly risksAddSignal: number;
  readonly decisionsAddSignal: number;
  readonly riskPrefill: RiskPrefillRequest | null;
  readonly onRisksChange: (next: readonly RiskEntry[]) => void;
  readonly onDecisionsChange: (next: readonly DecisionEntry[]) => void;
}

export interface LeadFormDialogsWriteActions {
  readonly showSubmitConfirm: boolean;
  readonly cancelSubmit: () => void;
  readonly handleConfirmSubmit: () => void;
  readonly submitPending: boolean;
  readonly showReopenDialog: boolean;
  readonly reopenPending: boolean;
  readonly reopenError: string | null;
  readonly handleRequestReopen: (reason: string | undefined) => void;
  readonly closeReopenDialog: () => void;
  readonly showRevokeDialog: boolean;
  readonly confirmRevoke: () => void;
  readonly cancelRevoke: () => void;
  readonly pendingFillFrom: boolean;
  readonly fillFromPending: boolean;
  readonly confirmPendingFillFrom: () => void;
  readonly cancelPendingFillFrom: () => void;
}

type StagesForProduct = ComponentProps<
  typeof ItemEditDialog
>["stagesForProduct"];

interface LeadFormDialogsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly quickAdd: LeadFormDialogsQuickAdd;
  readonly writeActions: LeadFormDialogsWriteActions;
  // Same count that feeds submit coercion — warning and coercion cannot disagree.
  readonly unsetOwnStageCount: number;
  readonly draftSection: ReportSectionReadModel;
  readonly isSlidesMode: boolean;
}

// Current and Next share this form-level host in both public views. Overview
// sections own the support dialogs; Slides mounts their form-level counterparts.
function QuickAddItemDialog({
  viewModel,
  quickAdd,
  draftSection,
}: {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly quickAdd: LeadFormDialogsQuickAdd;
  readonly draftSection: ReportSectionReadModel;
}) {
  const stagesForProduct: StagesForProduct = (productId) =>
    ownedStagesForProject(draftSection, productId);
  const { activityOptions, currentUser, ownPeriodRanks, products, risks } =
    viewModel;
  return (
    <ItemEditDialog
      key={`quick-add-${quickAdd.quickAddItem?.seq ?? 0}`}
      open={quickAdd.quickAddItem !== null}
      item={null}
      products={products}
      activities={activityOptions}
      week={quickAdd.quickAddItem?.week ?? "current"}
      currentUserName={currentUser.name}
      defaultProductId={products[0]?.id}
      stagesForProduct={stagesForProduct}
      ownPeriodRanks={ownPeriodRanks}
      risks={risks}
      onSave={quickAdd.onQuickAddSave}
      onCancel={quickAdd.onQuickAddCancel}
    />
  );
}

function SlidesQuickAddRiskDialog({
  viewModel,
  quickAdd,
  draftSection,
}: {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly quickAdd: LeadFormDialogsQuickAdd;
  readonly draftSection: ReportSectionReadModel;
}) {
  const dialog = useEditableListDialog<RiskEntry>({
    readOnly: viewModel.isReadOnly,
    addSignal: quickAdd.risksAddSignal,
    seedProductId: viewModel.products[0]?.id,
  });
  const { openCreate } = dialog;
  const lastPrefillSignal = useRef(quickAdd.riskPrefill?.signal ?? 0);
  const [activePrefill, setActivePrefill] = useReducer(
    (_current: RiskPrefillRequest | null, next: RiskPrefillRequest | null) =>
      next,
    null,
  );

  useEffect(() => {
    const prefill = quickAdd.riskPrefill;
    if (!prefill || prefill.signal <= lastPrefillSignal.current) return;
    lastPrefillSignal.current = prefill.signal;
    if (viewModel.isReadOnly) return;
    setActivePrefill(prefill);
    openCreate({
      ...(prefill.productId ? { productId: prefill.productId } : {}),
      ...(prefill.activityId ? { activityId: prefill.activityId } : {}),
    });
  }, [quickAdd.riskPrefill, openCreate, viewModel.isReadOnly]);

  const close = () => {
    setActivePrefill(null);
    dialog.close();
  };
  const state = dialog.dialogState;
  const createState = state.open && state.mode === "create" ? state : null;

  return (
    <RiskEditDialog
      key={dialog.dialogKey}
      open={state.open}
      risk={null}
      products={viewModel.products}
      activities={viewModel.activityOptions}
      defaultProductId={createState?.seedProductId}
      defaultActivityId={createState?.seedActivityId}
      initialStageNames={activePrefill?.stageNames}
      initialSeverity={activePrefill?.severity}
      stagesForProduct={(productId) =>
        ownedStagesForProject(draftSection, productId)
      }
      onSave={(saved) => {
        quickAdd.onRisksChange([...viewModel.ownRisks, saved]);
        close();
      }}
      onCancel={close}
    />
  );
}

function SlidesQuickAddDecisionDialog({
  viewModel,
  quickAdd,
  draftSection,
}: {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly quickAdd: LeadFormDialogsQuickAdd;
  readonly draftSection: ReportSectionReadModel;
}) {
  const dialog = useEditableListDialog<DecisionEntry>({
    readOnly: viewModel.isReadOnly,
    addSignal: quickAdd.decisionsAddSignal,
  });

  return (
    <DecisionEditDialog
      key={dialog.dialogKey}
      open={dialog.dialogState.open}
      decision={null}
      defaultOwner={viewModel.currentUser.name}
      stagesForProduct={(productId) =>
        ownedStagesForProject(draftSection, productId)
      }
      products={viewModel.products}
      activities={viewModel.activityOptions}
      defaultProductId={viewModel.products[0]?.id}
      onSave={(saved) => {
        quickAdd.onDecisionsChange([...viewModel.ownDecisions, saved]);
        dialog.close();
      }}
      onCancel={dialog.close}
    />
  );
}

function SlidesQuickAddDialogs({
  viewModel,
  quickAdd,
  draftSection,
}: {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly quickAdd: LeadFormDialogsQuickAdd;
  readonly draftSection: ReportSectionReadModel;
}) {
  return (
    <>
      <SlidesQuickAddRiskDialog
        viewModel={viewModel}
        quickAdd={quickAdd}
        draftSection={draftSection}
      />
      <SlidesQuickAddDecisionDialog
        viewModel={viewModel}
        quickAdd={quickAdd}
        draftSection={draftSection}
      />
    </>
  );
}

function SubmitConfirmDialogHost({
  viewModel,
  writeActions,
  unsetOwnStageCount,
}: {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly writeActions: LeadFormDialogsWriteActions;
  readonly unsetOwnStageCount: number;
}) {
  if (!writeActions.showSubmitConfirm) return null;
  return (
    <SubmitConfirmDialog
      counts={{
        currentWeekItems: viewModel.ownCurrentWeekItems.length,
        nextWeekItems: viewModel.ownNextWeekItems.length,
        risks: viewModel.ownRisks.length,
        decisions: viewModel.ownDecisions.length,
      }}
      unsetOwnStageCount={unsetOwnStageCount}
      submitPending={writeActions.submitPending}
      onConfirm={writeActions.handleConfirmSubmit}
      onCancel={writeActions.cancelSubmit}
    />
  );
}

export function LeadFormDialogs({
  viewModel,
  quickAdd,
  writeActions,
  unsetOwnStageCount,
  draftSection,
  isSlidesMode,
}: LeadFormDialogsProps) {
  return (
    <>
      <SubmitConfirmDialogHost
        viewModel={viewModel}
        writeActions={writeActions}
        unsetOwnStageCount={unsetOwnStageCount}
      />

      <QuickAddItemDialog
        viewModel={viewModel}
        quickAdd={quickAdd}
        draftSection={draftSection}
      />

      {isSlidesMode && (
        <SlidesQuickAddDialogs
          viewModel={viewModel}
          quickAdd={quickAdd}
          draftSection={draftSection}
        />
      )}

      <RequestReopenDialog
        open={writeActions.showReopenDialog}
        pending={writeActions.reopenPending}
        error={writeActions.reopenError}
        onConfirm={writeActions.handleRequestReopen}
        onCancel={writeActions.closeReopenDialog}
      />

      <ConfirmDeleteDialog
        open={writeActions.showRevokeDialog}
        title="Revoke this submission?"
        preview={viewModel.currentUser.name}
        subtitle="Their form returns to Draft and they can edit again."
        consequence="The lead will be notified that their submission was revoked."
        confirmLabel="Revoke"
        reversible
        onConfirm={writeActions.confirmRevoke}
        onCancel={writeActions.cancelRevoke}
      />

      <ConfirmationDialog
        open={writeActions.pendingFillFrom}
        title="Overwrite unsaved changes?"
        description="Fill from previous replaces the whole draft, including unsaved local edits."
        confirmLabel="Overwrite & fill"
        variant="destructive"
        isPending={writeActions.fillFromPending}
        onConfirm={writeActions.confirmPendingFillFrom}
        onClose={writeActions.cancelPendingFillFrom}
      />
    </>
  );
}
