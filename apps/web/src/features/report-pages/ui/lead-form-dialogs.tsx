"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { ComponentProps } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { RequestReopenDialog } from "../../period";
import type { LeadFormLoadedViewModel } from "../../report-sections";
import {
  ItemEditDialog,
  type KanbanItem,
  ownedStagesForProject,
} from "../../report-sections";
import type { QuickAddItem } from "../../report-sections/client";
import { SubmitConfirmDialog } from "./submit-confirm-dialog";

export interface LeadFormDialogsQuickAdd {
  readonly quickAddItem: QuickAddItem | null;
  readonly onQuickAddSave: (item: KanbanItem) => void;
  readonly onQuickAddCancel: () => void;
}

export interface LeadFormDialogsWriteActions {
  readonly showSubmitConfirm: boolean;
  readonly setShowSubmitConfirm: (open: boolean) => void;
  readonly handleConfirmSubmit: () => void;
  readonly submitPending: boolean;
  readonly showReopenDialog: boolean;
  readonly requestReopenMut: { readonly isPending: boolean };
  readonly reopenError: string | null;
  readonly handleRequestReopen: (reason: string | undefined) => void;
  readonly closeReopenDialog: () => void;
  readonly showRevokeDialog: boolean;
  readonly confirmRevoke: () => void;
  readonly setShowRevokeDialog: (open: boolean) => void;
  readonly pendingFillFrom: boolean;
  readonly fillFromMut: { readonly isPending: boolean };
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
}

// Quick-add item dialog host — the EXISTING item dialog opened by the picker for
// current-item / next-item. The risk / blocker / decision quick-adds open the
// dialogs the sections already host (a blocker rides the blocked-risk prefill).
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
      onCancel={() => writeActions.setShowSubmitConfirm(false)}
    />
  );
}

export function LeadFormDialogs({
  viewModel,
  quickAdd,
  writeActions,
  unsetOwnStageCount,
  draftSection,
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

      <RequestReopenDialog
        open={writeActions.showReopenDialog}
        pending={writeActions.requestReopenMut.isPending}
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
        onCancel={() => writeActions.setShowRevokeDialog(false)}
      />

      <ConfirmationDialog
        open={writeActions.pendingFillFrom}
        title="Overwrite unsaved changes?"
        description="Fill from previous replaces the whole draft, including unsaved local edits."
        confirmLabel="Overwrite & Fill"
        variant="destructive"
        isPending={writeActions.fillFromMut.isPending}
        onConfirm={writeActions.confirmPendingFillFrom}
        onClose={writeActions.cancelPendingFillFrom}
      />
    </>
  );
}
