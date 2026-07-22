"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { ComponentProps } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { RequestReopenDialog } from "../../period";
import {
  ItemEditDialog,
  type KanbanItem,
  ownedStagesForProject,
} from "../../report-sections";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import type { QuickAddItem } from "./use-lead-form-draft";

/** The quick-add dialog slice the dialogs host renders from. */
export interface LeadFormDialogsQuickAdd {
  readonly quickAddItem: QuickAddItem | null;
  readonly onQuickAddSave: (item: KanbanItem) => void;
  readonly onQuickAddCancel: () => void;
}

/** The dialog-lifecycle slice the dialogs host drives. */
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
}

type StagesForProduct = ComponentProps<
  typeof ItemEditDialog
>["stagesForProduct"];

interface LeadFormDialogsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly quickAdd: LeadFormDialogsQuickAdd;
  readonly writeActions: LeadFormDialogsWriteActions;
  /**
   * Count of the lead's own unset stages. Derived in `LeadForm` from
   * `draftPayload.stageStatuses` — the
   * same single count feeds the submit coercion, so the warning here and the
   * coercion can never disagree.
   */
  readonly unsetOwnStageCount: number;
  /** The editable draft section — the stage selector derives from it. */
  readonly draftSection: ReportSectionReadModel;
}

/**
 * The lead form's dialog cluster: submit confirmation, the quick-add item
 * dialog host, request-reopen, and revoke confirmation.
 */
export function LeadFormDialogs({
  viewModel,
  quickAdd,
  writeActions,
  unsetOwnStageCount,
  draftSection,
}: LeadFormDialogsProps) {
  // Scope the quick-add stage selector to the stages the lead owns for that
  // project, matching the section-hosted dialogs.
  const stagesForProduct: StagesForProduct = (productId) =>
    ownedStagesForProject(draftSection, productId);
  const {
    activityOptions,
    currentUser,
    ownCurrentWeekItems,
    ownDecisions,
    ownNextWeekItems,
    ownPeriodRanks,
    ownRisks,
    products,
    risks,
  } = viewModel;
  return (
    <>
      {/* Submit Confirmation Dialog */}
      {writeActions.showSubmitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm submission"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Submit your report?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Your report will be locked and visible to the group head. You will
              not be able to make changes after submission.
            </p>
            {/* The submit summary counts the lead's own records only —
                it reflects what will actually be submitted, never the foreign
                read-only records merged in for the Everyone lens. */}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {ownCurrentWeekItems.length}
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  current week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownNextWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  next week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownRisks.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  risks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownDecisions.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  decisions
                </span>
              </div>
            </div>
            {/* Warn that unset own stages will be promoted to On Track on submit
                so the coercion is explicit. Omitted when nothing is unset. */}
            {unsetOwnStageCount > 0 && (
              <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
                {unsetOwnStageCount} stage
                {unsetOwnStageCount === 1 ? "" : "s"} not set — they will be
                marked On Track.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                onClick={() => writeActions.setShowSubmitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={writeActions.handleConfirmSubmit}
                disabled={writeActions.submitPending}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add item dialog host — the EXISTING item dialog opened by the
          picker for current-item / next-item. The risk / blocker / decision
          quick-adds open the dialogs the sections already host (a blocker rides
          the severity-blocked risk prefill). */}
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
        preview={currentUser.name}
        subtitle="Their form returns to Draft and they can edit again."
        consequence="The lead will be notified that their submission was revoked."
        confirmLabel="Revoke"
        reversible
        onConfirm={writeActions.confirmRevoke}
        onCancel={() => writeActions.setShowRevokeDialog(false)}
      />
    </>
  );
}
