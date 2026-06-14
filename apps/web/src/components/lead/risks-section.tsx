"use client";

import { useEffect, useState } from "react";

import { useEditableListDialog } from "../../hooks/use-editable-list-dialog";
import { LockBadge } from "../report-shell/lock-badge";
import { MetaRow } from "../report-shell/meta-row";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import type { Product, RiskEntry } from "./mock-data";
import { DeleteIcon, EditIcon } from "./risk-card-icons";
import { RiskEditDialog } from "./risk-edit-dialog";
import { canonicalStageName, splitStageNames } from "./stage-tags";

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
    openCreate(addPrefill.productId);
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
          const isBlocked = risk.severity === "blocked";
          const stageTags =
            risk.stageIds && risk.stageIds.length > 0
              ? risk.stageIds.map(canonicalStageName)
              : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
                splitStageNames(risk.stageName);
          // require-risk-stage (D2): a risk with no stages is an anomaly
          // (legacy row), never an implicit "all stages" scope — render the
          // loud "No stage set" warning chip instead of disguising it.
          // Keep every selected stage visible; seven SDLC chips fit better
          // than hiding critical scope behind "+N".
          const stageTagsLabel =
            stageTags.length === 0 ? "No stage set" : stageTags.join(", ");
          // F4: warn when the linked product is at-risk/blocked but no
          // explicit stage is selected for this risk row.
          const linkedProductStatus = products?.find(
            (p) => p.id === risk.productId,
          )?.overallStatus;
          const needsStage =
            !readOnly &&
            (linkedProductStatus === "at-risk" ||
              linkedProductStatus === "blocked") &&
            stageTags.length === 0;
          const locked = readOnly || risk.foreign === true;
          return (
            <div
              key={risk.id}
              data-testid="risk-card"
              className="rounded-xl p-4"
              style={{
                background: isBlocked ? "#fdf8f8" : "#fffcf5",
                border: `1px solid ${isBlocked ? "rgba(200,32,20,0.15)" : "rgba(212,160,23,0.15)"}`,
                opacity: risk.foreign ? 0.7 : 1,
              }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: isBlocked ? "#fee2e2" : "#fef3c7",
                    color: isBlocked ? "var(--color-destructive)" : "#8a6d1b",
                  }}
                >
                  {isBlocked ? "Blocked" : "At Risk"}
                </span>
                <span className="font-[family-name:var(--font-sans)] text-sm font-semibold break-words">
                  {risk.productName}
                </span>
                {!locked ? (
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                      onClick={() => handleEdit(risk)}
                      aria-label={`Edit risk for ${risk.productName}`}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                      onClick={() => handleDelete(risk.id)}
                      aria-label={`Delete risk for ${risk.productName}`}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                ) : risk.foreign === true ? (
                  <div className="ml-auto flex gap-1">
                    <LockBadge
                      authorName={risk.authorName ?? sectionAuthorName}
                    />
                  </div>
                ) : null}
              </div>
              {/* Risk + impact + mitigation summary — read-only on the
                  card; the dialog is the only edit surface so we can
                  validate all three fields together. */}
              <div className="space-y-2 text-sm text-[var(--color-foreground)]">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    Risk
                  </span>
                  <div className="mt-0.5 break-words">
                    {risk.text || (
                      <em className="text-[var(--color-muted-foreground)]">
                        — pending
                      </em>
                    )}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                      Impact
                    </span>
                    <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
                      {risk.impact || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                      Mitigation
                    </span>
                    <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
                      {risk.mitigation || "—"}
                    </div>
                  </div>
                </div>
              </div>
              {/* F4: required-mark when product is at-risk/blocked but no stage selected */}
              {needsStage && (
                <p className="mt-2 text-[11px] font-semibold text-[#8a6d1b]">
                  ⚠ Select at least one stage — required for at-risk/blocked
                  products.
                </p>
              )}
              {/* P5: unified [author …… chip] meta-row */}
              <MetaRow
                authorName={risk.authorName ?? sectionAuthorName}
                stageTags={stageTags}
                ariaLabel={`Risk stages: ${stageTagsLabel}`}
                foreign={false}
                emptyStageChip="no-stage-warning"
              />
            </div>
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
            ? // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
              `${pendingDelete.productName} · ${(pendingDelete.stageIds?.length ? pendingDelete.stageIds : splitStageNames(pendingDelete.stageName)).length > 0 ? (pendingDelete.stageIds?.length ? pendingDelete.stageIds : splitStageNames(pendingDelete.stageName)).join(", ") : "no stage set"}`
            : undefined
        }
        onConfirm={confirmDelete}
        onCancel={clearPendingDelete}
      />
    </div>
  );
}
