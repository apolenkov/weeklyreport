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
  readonly decisions: readonly DecisionEntry[];
  readonly readOnly?: boolean | undefined;
  readonly onChange?: ((decisions: DecisionEntry[]) => void) | undefined;
  readonly defaultProductName?: string | undefined;
  // Seeds new decision owners; edit/delete uses the id-based `foreign` flag,
  // never a free-text name match.
  readonly currentUserName?: string | undefined;
  // Re-scopes available stages when the selected product changes.
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly products?: readonly Product[] | undefined;
  // Lets a decision use an attached activity rather than a product as parent.
  readonly activities?: readonly ParentActivityOption[] | undefined;
  readonly defaultProductId?: string | undefined;
  readonly addSignal?: number | undefined;
  // Published-lineage rows stay resolvable but cannot be deleted.
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
}

// A decision created from this section keeps the parent label the dialog
// actually resolved — an absent product name is never replaced with a
// fabricated catch-all label.
function withCreateDefaults(
  saved: DecisionEntry,
  defaultProductName: string | undefined,
): DecisionEntry {
  return {
    ...saved,
    productName: saved.productName || defaultProductName || "",
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
  readonly decisions: readonly DecisionEntry[];
  readonly readOnly: boolean;
  readonly publishedLockedIds: ReadonlySet<string> | undefined;
  readonly onEdit: (decision: DecisionEntry) => void;
  readonly onDelete: (id: string) => void;
}) {
  if (decisions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-empty)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
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
