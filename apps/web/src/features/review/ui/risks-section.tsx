"use client";

import { useEffect, useState } from "react";

import { useEditableListDialog } from "../../../hooks/use-editable-list-dialog";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import { canonicalRiskStageTags, RiskCard } from "./risk-card";
import { RiskEditDialog } from "./risk-edit-dialog";
import { deriveRiskDialogSeedProps } from "./risk-edit-dialog-helpers";

interface RisksSectionProps {
  readonly risks: RiskEntry[];
  readonly readOnly?: boolean;
  readonly onChange?: (next: RiskEntry[]) => void;
  // Each signal increment opens create prefilled with product/stage/severity.
  readonly addPrefill?: {
    signal: number;
    productId: string;
    stageIds: string[];
    severity: "at-risk" | "blocked";
    // Pill raise — preselects the activity parent.
    activityId?: string;
  };
  // Absent/empty disables +Add Risk (dialog needs a project picker seed).
  readonly products?: readonly Product[];
  readonly activities?: readonly ParentActivityOption[];
  // Owned stages for the dialog stage selector, scoped per project.
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly sectionAuthorName?: string;
  readonly addSignal?: number;
}

/**
 * Risks Section.
 * @param props - The props argument.
 */
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
  const firstProductId = products?.[0]?.id;

  // requireSeed is false: a risk can be created before any product exists.
  const {
    dialogState,
    dialogKey,
    openCreate,
    openEdit,
    close,
    pendingDelete,
    requestDelete,
    clearPendingDelete,
  } = useEditableListDialog<RiskEntry>({
    readOnly,
    addSignal,
    seedProductId: firstProductId,
  });

  // Chip-raise prefill lives caller-side; cleared on close so plain +Add is clean.
  const [createPrefill, setCreatePrefill] = useState<{
    stageIds?: string[];
    severity?: "at-risk" | "blocked";
  } | null>(null);

  function handleDelete(id: string) {
    const risk = risks.find((r) => r.id === id);
    if (!risk) return;
    requestDelete(risk);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onChange?.(risks.filter((r) => r.id !== pendingDelete.id));
    clearPendingDelete();
  }

  function handleEdit(risk: RiskEntry) {
    openEdit(risk);
  }

  // One-click severity flip; applyRiskSeverityFloor re-derives stage chips
  // so a blocker→at-risk lowers the covered stage without the edit dialog.
  function handleToggleSeverity(risk: RiskEntry) {
    if (readOnly) return;
    const nextSeverity = risk.severity === "blocked" ? "at-risk" : "blocked";
    onChange?.(
      risks.map((r) =>
        r.id === risk.id ? { ...r, severity: nextSeverity } : r,
      ),
    );
  }

  function handleDialogSave(
    saved: RiskEntry & { impact: string; mitigation: string },
  ) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onChange?.([...risks, saved]);
    } else {
      onChange?.(risks.map((r) => (r.id === saved.id ? saved : r)));
    }
    setCreatePrefill(null);
    close();
  }

  function handleDialogCancel() {
    setCreatePrefill(null);
    close();
  }

  // Stash chip-raise stage/severity; the hook owns the open source + stale guard.
  useEffect(() => {
    if (!addPrefill || addPrefill.signal === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the addPrefill SIGNAL prop (an event delivered via props); state updates are the event's handler
    setCreatePrefill({
      stageIds: addPrefill.stageIds,
      severity: addPrefill.severity,
    });
    openCreate({
      productId: addPrefill.productId,
      activityId: addPrefill.activityId,
    });
  }, [addPrefill, openCreate]);

  return (
    <div className="space-y-4">
      {risks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {readOnly
            ? "No risks reported."
            : "No risks reported. Use “+ Add Risk” when you spot one."}
        </div>
      ) : (
        risks.map((risk) => {
          const linkedProductStatus = products?.find(
            (p) => p.id === risk.productId,
          )?.overallStatus;
          return (
            <RiskCard
              key={risk.id}
              risk={risk}
              readOnly={readOnly}
              sectionAuthorName={sectionAuthorName}
              linkedProductStatus={linkedProductStatus}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleSeverity={handleToggleSeverity}
            />
          );
        })
      )}

      <RiskEditDialog
        key={dialogKey}
        open={dialogState.open}
        products={products ?? []}
        activities={activities}
        stagesForProduct={stagesForProduct}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
        {...deriveRiskDialogSeedProps(dialogState, createPrefill)}
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
        onConfirm={confirmDelete}
        onCancel={clearPendingDelete}
      />
    </div>
  );
}
