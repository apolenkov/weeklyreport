"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { ComponentProps } from "react";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { RequestReopenDialog } from "../../period/ui/request-reopen-dialog";
import { ownedStagesForProject } from "../model/lead-form";
import { ItemEditDialog } from "./item-edit-dialog";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import type { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";
import type { useLeadFormWriteActions } from "./use-lead-form-write-actions";

type LeadFormDraftMerges = ReturnType<typeof useLeadFormDraftMerges>;
type LeadFormWriteActions = ReturnType<typeof useLeadFormWriteActions>;
type StagesForProduct = ComponentProps<
  typeof ItemEditDialog
>["stagesForProduct"];

interface LeadFormDialogsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly merges: LeadFormDraftMerges;
  readonly writeActions: LeadFormWriteActions;
  /**
   * simplify-stage-status-interaction (D4): count of the lead's own unset
   * stages. Derived in `LeadForm` from `draftPayload.stageStatuses` — the
   * same single count feeds the submit coercion, so the warning here and the
   * coercion can never disagree.
   */
  readonly unsetOwnStageCount: number;
  /** The editable draft section — the stage selector derives from it. */
  readonly draftSection: ReportSectionReadModel;
}

/**
 * The lead form's dialog cluster: submit confirmation, the quick-add item
 * dialog host, request-reopen, and revoke confirmation. Pure relocation from
 * `LeadForm` — markup and mount/`open` semantics unchanged.
 */
export function LeadFormDialogs({
  viewModel,
  merges,
  writeActions,
  unsetOwnStageCount,
  draftSection,
}: LeadFormDialogsProps) {
  // 35-04: per-project stages-the-lead-owns selector for the quick-add item
  // dialog, scoped per project like the section-hosted dialogs.
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
            {/* 7c.5: the submit summary counts the lead's OWN records only —
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
            {/* simplify-stage-status-interaction (D4): warn that unset own
                stages will be promoted to On Track on submit — announced, not
                silent. Omitted when nothing is unset. */}
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
                disabled={writeActions.submitMut.isPending}
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
        key={`quick-add-${merges.quickAddItem?.seq ?? 0}`}
        open={merges.quickAddItem !== null}
        item={null}
        products={products}
        activities={activityOptions}
        week={merges.quickAddItem?.week ?? "current"}
        currentUserName={currentUser.name}
        defaultProductId={products[0]?.id}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={merges.handleQuickAddSave}
        onCancel={merges.handleQuickAddCancel}
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
