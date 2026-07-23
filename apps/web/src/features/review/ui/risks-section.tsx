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
  /** Controlled-component callback fired with the next risks array on add/edit/delete. */
  readonly onChange?: (next: RiskEntry[]) => void;
  /**
   * Chip-raise interception payload. Each `signal` increment opens the
   * create dialog prefilled with the clicked product, stage, and severity.
   */
  readonly addPrefill?: {
    signal: number;
    productId: string;
    stageIds: string[];
    severity: "at-risk" | "blocked";
    /** Activity-scoped prefill (pill raise) — preselects the activity parent. */
    activityId?: string;
  };
  /**
   * Products list — required so the edit dialog can show a project picker
   * and the empty-state can seed the first product. When absent or empty,
   * the +Add Risk button is rendered disabled with a tooltip.
   */
  readonly products?: readonly Product[];
  /** Attached activities forwarded to the parent picker. */
  readonly activities?: readonly ParentActivityOption[];
  /**
   * Callback returning the SDLC stages the lead owns on a given project.
   * Forwarded to the dialog so the stage selector is scoped per-project.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * Display name of the section author (the lead who owns this section).
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

  // Shared dialog lifecycle (DialogState union, readOnly-ref add-signal
  // effect, openSeq remount key, pending-delete). requireSeed is false:
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

  // Create-mode prefill (clicked stage + severity) for the chip-raise
  // interception. The hook owns the single open source, so this stays
  // caller-side and is cleared on close so a later plain "+ Add Risk"
  // mounts clean.
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

  // One-click blocked <-> at-risk flip without the full edit dialog. The
  // chip's displayed severity re-derives from this on the next render
  // (applyRiskSeverityFloor), so downgrading a blocker to a risk lowers the
  // covered stage in a single click.
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

  // Chip-raise interception opens the create dialog prefilled. The readOnly
  // stale-signal guard lives in the hook; here we stash the clicked
  // stage/severity, then ask the hook to open create mode seeded with the
  // clicked product (one open source).
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
      {/* Status is derived from risks, so a chip can no longer be
          at-risk/blocked without a backing risk — there is no unbacked-stage
          state left to warn about. */}

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
