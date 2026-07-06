"use client";

import { useEffect, useState } from "react";

import { useEditableListDialog } from "../../hooks/use-editable-list-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import type { Product, RiskEntry } from "./mock-data";
import { canonicalRiskStageTags, RiskCard } from "./risk-card";
import { RiskEditDialog } from "./risk-edit-dialog";

interface RisksSectionProps {
  readonly risks: RiskEntry[];
  readonly readOnly?: boolean;
  /** Controlled-component callback fired with the next risks array on add/edit/delete. */
  readonly onChange?: (next: RiskEntry[]) => void;
  /**
   * unify-risk-stage-status (D2): chip-raise interception payload. Each
   * `signal` increment opens the create dialog prefilled with the clicked
   * product, stage, and severity.
   */
  readonly addPrefill?: {
    signal: number;
    productId: string;
    stageIds: string[];
    severity: "at-risk" | "blocked";
  };
  /**
   * Products list — required so the edit dialog can show a project picker
   * and the empty-state can seed the first product. When absent or empty,
   * the +Add Risk button is rendered disabled with a tooltip.
   */
  readonly products?: readonly Product[];
  /** activity-first-class: attached activities forwarded to the parent picker. */
  readonly activities?: readonly { id: string; name: string }[];
  /**
   * 35-04 (FEAT-144): callback returning the SDLC stages the lead owns on
   * a given project. Forwarded to the dialog so the stage selector is
   * scoped per-project.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * P5: Display name of the section author (the lead who owns this section).
   * Shown at the bottom-left of each risk card in the unified meta-row.
   */
  readonly sectionAuthorName?: string;
  readonly addSignal?: number;
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
  const firstProductId = products?.[0]?.id;

  // Shared dialog lifecycle (DialogState union, D1 readOnly-ref add-signal
  // effect, D13 openSeq remount key, pending-delete). requireSeed is false:
  // a risk can be created even before any product exists.
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

  // unify-risk-stage-status (D2): create-mode prefill (clicked stage +
  // severity) for the chip-raise interception. The hook owns the single
  // open source, so this stays caller-side (D3) and is cleared on close so
  // a later plain "+ Add Risk" mounts clean.
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

  // unify-risk-stage-status (D2): chip-raise interception opens the create
  // dialog prefilled. The readOnly stale-signal guard now lives in the hook;
  // here we stash the clicked stage/severity, then ask the hook to open
  // create mode seeded with the clicked product (one open source).
  useEffect(() => {
    if (!addPrefill || addPrefill.signal === 0) return;
    setCreatePrefill({
      stageIds: addPrefill.stageIds,
      severity: addPrefill.severity,
    });
    openCreate({ productId: addPrefill.productId });
  }, [addPrefill, openCreate]);

  return (
    <div className="space-y-4">
      {/* rethink-pipeline-state-vs-completeness: the unbacked-stage warning
          was removed. Status is derived from risks, so a chip can no longer
          be at-risk/blocked without a backing risk — there is nothing left
          to warn about. */}

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
            />
          );
        })
      )}

      <RiskEditDialog
        key={dialogKey}
        open={dialogState.open}
        risk={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.entity
            : null
        }
        products={products ?? []}
        activities={activities}
        defaultProductId={
          dialogState.open && dialogState.mode === "create"
            ? dialogState.seedProductId
            : undefined
        }
        initialStageIds={
          dialogState.open && dialogState.mode === "create"
            ? createPrefill?.stageIds
            : undefined
        }
        initialSeverity={
          dialogState.open && dialogState.mode === "create"
            ? createPrefill?.severity
            : undefined
        }
        initialImpact={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.entity.impact
            : ""
        }
        initialMitigation={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.entity.mitigation
            : ""
        }
        stagesForProduct={stagesForProduct}
        onSave={handleDialogSave}
        onCancel={handleDialogCancel}
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
