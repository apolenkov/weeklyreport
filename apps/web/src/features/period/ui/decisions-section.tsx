"use client";

import { Fragment } from "react";

import { useEditableListDialog } from "../../../hooks/use-editable-list-dialog";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
} from "../../report-sections";
import { DecisionCard } from "./decision-card";
import { DecisionEditDialog } from "./decision-edit-dialog";

interface DecisionsSectionProps {
  readonly decisions: DecisionEntry[];
  readonly readOnly?: boolean;
  readonly onChange?: (decisions: DecisionEntry[]) => void;
  /**
   * Optional default product label for newly-added decisions. The decision
   * schema is department-scoped (no projectId), so this only seeds the chip
   * shown above the input. Falls back to "Department".
   */
  readonly defaultProductName?: string;
  /**
   * Display name of the currently signed-in user. Used to seed the Owner
   * field for newly-created decisions. Ownership for Edit/Delete is decided
   * by the id-based `foreign` flag, NOT by matching this free-text name.
   */
  readonly currentUserName?: string;
  /**
   * unify-record-dialogs: stages owned on the SELECTED product — passed through
   * to the dialog so a decision is product-scoped like an item/risk.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /** R4-B: products the lead is assigned to, passed through to the dialog. */
  readonly products?: readonly Product[];
  /**
   * activity-first-class: the author's attached activities, forwarded to the
   * dialog so a decision can be scoped to an activity (Decision 0.4 — parity
   * with the item/risk sections).
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly addSignal?: number;
  /**
   * Resolve-not-delete (ADR 0015): decision ids whose lineage appeared in a
   * published report. Locked rows show the "In published report" marker and
   * withhold Delete (the server rejects the drop anyway).
   */
  readonly publishedLockedIds?: ReadonlySet<string>;
}

export function DecisionsSection({
  decisions,
  readOnly = false,
  onChange,
  defaultProductName,
  currentUserName,
  stagesForProduct,
  products,
  activities,
  defaultProductId,
  addSignal = 0,
  publishedLockedIds,
}: DecisionsSectionProps) {
  // Shared dialog lifecycle (DialogState union, D1 readOnly-ref add-signal
  // effect, D13 openSeq remount key, pending-delete). Create mode has no
  // seed product — the dialog gets defaultProductId directly as a prop — so
  // requireSeed stays false.
  const {
    dialogState,
    dialogKey,
    openEdit,
    close,
    pendingDelete,
    requestDelete,
    clearPendingDelete,
  } = useEditableListDialog<DecisionEntry>({ readOnly, addSignal });

  function handleDelete(id: string) {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;
    requestDelete(decision);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onChange?.(decisions.filter((d) => d.id !== pendingDelete.id));
    clearPendingDelete();
  }

  function handleEdit(decision: DecisionEntry) {
    openEdit(decision);
  }

  function handleDialogSave(saved: DecisionEntry) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onChange?.([
        ...decisions,
        {
          ...saved,
          productName: saved.productName || defaultProductName || "Group",
          // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
          stageName: saved.stageName ?? "—",
        },
      ]);
    } else {
      onChange?.(decisions.map((d) => (d.id === saved.id ? saved : d)));
    }
    close();
  }

  function handleDialogCancel() {
    close();
  }

  return (
    <div className="space-y-3">
      {decisions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {readOnly
            ? "No decisions reported."
            : "No decisions yet. Use “+ Add Decision” to flag one for the head."}
        </div>
      ) : (
        decisions.map((decision) => (
          <Fragment key={decision.id}>
            <DecisionCard
              decision={decision}
              readOnly={readOnly}
              publishedLocked={publishedLockedIds?.has(decision.id) === true}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </Fragment>
        ))
      )}

      <DecisionEditDialog
        key={dialogKey}
        open={dialogState.open}
        decision={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.entity
            : null
        }
        defaultOwner={currentUserName}
        stagesForProduct={stagesForProduct}
        products={products}
        activities={activities}
        defaultProductId={defaultProductId}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete decision?"
        preview={pendingDelete?.text || "(no description)"}
        subtitle={pendingDelete ? `Owner: ${pendingDelete.owner}` : undefined}
        onConfirm={confirmDelete}
        onCancel={clearPendingDelete}
      />
    </div>
  );
}
