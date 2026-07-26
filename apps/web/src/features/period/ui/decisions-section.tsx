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
  readonly defaultProductName?: string;
  /**
   * Display name of the currently signed-in user. Used to seed the Owner
   * field for newly-created decisions. Ownership for Edit/Delete is decided
   * by the id-based `foreign` flag, NOT by matching this free-text name.
   */
  readonly currentUserName?: string;
  /**
   * Stages owned on the selected product, passed through so changing the
   * product re-scopes the available stages.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly products?: readonly Product[];
  /**
   * The author's attached activities, forwarded so a decision can use an
   * activity rather than a product as its parent.
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly addSignal?: number;
  /**
   * Decision ids locked because their lineage appeared in a published report;
   * rows stay resolvable but cannot be deleted (server rejects the write).
   */
  readonly publishedLockedIds?: ReadonlySet<string>;
}

// A decision created from this section inherits the section's product when the
// dialog left it blank; "Group" is the catch-all for group-level decisions.
function withCreateDefaults(
  saved: DecisionEntry,
  defaultProductName: string | undefined,
): DecisionEntry {
  return {
    ...saved,
    productName: saved.productName || defaultProductName || "Group",
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
    stageName: saved.stageName ?? "—",
  };
}

// Owns the create/edit dialog and the confirm-delete flow; every write rebuilds
// the list and hands it back through `onChange`.
function useDecisionsEditing({
  decisions,
  readOnly = false,
  onChange,
  defaultProductName,
  addSignal = 0,
}: DecisionsSectionProps) {
  const {
    dialogState,
    dialogKey,
    openEdit,
    close,
    pendingDelete,
    requestDelete,
    clearPendingDelete,
  } = useEditableListDialog<DecisionEntry>({ readOnly, addSignal });

  const requestDeleteById = (id: string) => {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;
    requestDelete(decision);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    onChange?.(decisions.filter((d) => d.id !== pendingDelete.id));
    clearPendingDelete();
  };

  const saveDecision = (saved: DecisionEntry) => {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onChange?.([...decisions, withCreateDefaults(saved, defaultProductName)]);
    } else {
      onChange?.(decisions.map((d) => (d.id === saved.id ? saved : d)));
    }
    close();
  };

  return {
    dialogState,
    dialogKey,
    pendingDelete,
    clearPendingDelete,
    openEdit,
    requestDeleteById,
    confirmDelete,
    saveDecision,
    cancelDialog: close,
  };
}

function DecisionsList({
  decisions,
  readOnly,
  publishedLockedIds,
  onEdit,
  onDelete,
}: {
  readonly decisions: DecisionEntry[];
  readonly readOnly: boolean;
  readonly publishedLockedIds: ReadonlySet<string> | undefined;
  readonly onEdit: (decision: DecisionEntry) => void;
  readonly onDelete: (id: string) => void;
}) {
  if (decisions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {readOnly
          ? "No decisions reported."
          : "No decisions yet. Use “+ Add Decision” to flag one for the head."}
      </div>
    );
  }

  return (
    <>
      {decisions.map((decision) => (
        <Fragment key={decision.id}>
          <DecisionCard
            decision={decision}
            readOnly={readOnly}
            publishedLocked={publishedLockedIds?.has(decision.id) === true}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </Fragment>
      ))}
    </>
  );
}

export function DecisionsSection(props: DecisionsSectionProps) {
  const editing = useDecisionsEditing(props);
  const { dialogState, pendingDelete } = editing;

  return (
    <div className="space-y-3">
      <DecisionsList
        decisions={props.decisions}
        readOnly={props.readOnly ?? false}
        publishedLockedIds={props.publishedLockedIds}
        onEdit={editing.openEdit}
        onDelete={editing.requestDeleteById}
      />

      <DecisionEditDialog
        key={editing.dialogKey}
        open={dialogState.open}
        decision={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.entity
            : null
        }
        defaultOwner={props.currentUserName}
        stagesForProduct={props.stagesForProduct}
        products={props.products}
        activities={props.activities}
        defaultProductId={props.defaultProductId}
        onSave={editing.saveDecision}
        onCancel={editing.cancelDialog}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete decision?"
        preview={pendingDelete?.text || "(no description)"}
        subtitle={pendingDelete ? `Owner: ${pendingDelete.owner}` : undefined}
        onConfirm={editing.confirmDelete}
        onCancel={editing.clearPendingDelete}
      />
    </div>
  );
}
