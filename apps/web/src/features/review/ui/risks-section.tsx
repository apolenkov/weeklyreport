"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import { canonicalRiskStageTags, RiskCard } from "./risk-card";
import { RiskEditDialog } from "./risk-edit-dialog";
import { deriveRiskDialogSeedProps } from "./risk-edit-dialog-helpers";
import type { RiskAddPrefill, RiskListEditing } from "./use-risk-list-editing";
import { useRiskListEditing } from "./use-risk-list-editing";

interface RisksSectionProps {
  readonly risks: RiskEntry[];
  readonly readOnly?: boolean | undefined;
  readonly onChange?: ((next: RiskEntry[]) => void) | undefined;
  readonly addPrefill?: RiskAddPrefill | undefined;
  // Absent/empty disables +Add Risk (dialog needs a project picker seed).
  readonly products?: readonly Product[] | undefined;
  readonly activities?: readonly ParentActivityOption[] | undefined;
  // Owned stages for the dialog stage selector, scoped per project.
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly sectionAuthorName?: string | undefined;
  readonly addSignal?: number | undefined;
}

interface RiskListProps {
  readonly risks: RiskEntry[];
  readonly readOnly: boolean;
  readonly products?: readonly Product[] | undefined;
  readonly sectionAuthorName?: string | undefined;
  readonly onEdit: (risk: RiskEntry) => void;
  readonly onDelete: (id: string) => void;
  readonly onToggleSeverity: (risk: RiskEntry) => void;
}

function RiskList({
  risks,
  readOnly,
  products,
  sectionAuthorName,
  onEdit,
  onDelete,
  onToggleSeverity,
}: RiskListProps) {
  if (risks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {readOnly
          ? "No risks reported."
          : "No risks reported. Use “+ Add Risk” when you spot one."}
      </div>
    );
  }

  return (
    <>
      {risks.map((risk) => (
        <RiskCard
          key={risk.id}
          risk={risk}
          readOnly={readOnly}
          sectionAuthorName={sectionAuthorName}
          linkedProductStatus={
            products?.find((product) => product.id === risk.productId)
              ?.overallStatus
          }
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleSeverity={onToggleSeverity}
        />
      ))}
    </>
  );
}

interface RisksSectionDialogsProps {
  readonly editing: RiskListEditing;
  readonly products?: readonly Product[] | undefined;
  readonly activities?: readonly ParentActivityOption[] | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
}

function RisksSectionDialogs({
  editing,
  products,
  activities,
  stagesForProduct,
}: RisksSectionDialogsProps) {
  const { pendingDelete } = editing;

  return (
    <>
      <RiskEditDialog
        key={editing.dialogKey}
        open={editing.dialogState.open}
        products={products ?? []}
        activities={activities}
        stagesForProduct={stagesForProduct}
        onSave={editing.saveFromDialog}
        onCancel={editing.cancelDialog}
        {...deriveRiskDialogSeedProps(
          editing.dialogState,
          editing.createPrefill,
        )}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete risk?"
        preview={pendingDelete?.text || "(no description)"}
        subtitle={
          pendingDelete
            ? `${pendingDelete.productName} · ${
                canonicalRiskStageTags(pendingDelete).join(", ") ||
                "no stage set"
              }`
            : undefined
        }
        onConfirm={editing.confirmDelete}
        onCancel={editing.clearPendingDelete}
      />
    </>
  );
}

export function RisksSection({
  risks,
  readOnly = false,
  onChange,
  addPrefill,
  products,
  activities,
  stagesForProduct,
  sectionAuthorName,
  addSignal = 0,
}: RisksSectionProps) {
  const editing = useRiskListEditing({
    risks,
    readOnly,
    onChange,
    addSignal,
    addPrefill,
    seedProductId: products?.[0]?.id,
  });

  return (
    <div className="space-y-4">
      <RiskList
        risks={risks}
        readOnly={readOnly}
        products={products}
        sectionAuthorName={sectionAuthorName}
        onEdit={editing.openEdit}
        onDelete={editing.requestDeleteById}
        onToggleSeverity={editing.toggleSeverity}
      />

      <RisksSectionDialogs
        editing={editing}
        products={products}
        activities={activities}
        stagesForProduct={stagesForProduct}
      />
    </div>
  );
}
