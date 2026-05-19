"use client";

import { useEffect, useState } from "react";

import { MetaRow } from "../report-shell/meta-row";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { RiskEditDialog } from "./risk-edit-dialog";
import type { Product, RiskEntry } from "./mock-data";
import { splitStageNames } from "./stage-tags";

type RisksSectionProps = {
  readonly risks: RiskEntry[];
  readonly readOnly?: boolean;
  /** Controlled-component callback fired with the next risks array on add/edit/delete. */
  readonly onChange?: (next: RiskEntry[]) => void;
  /** Fired when the text of a risk transitions empty -> non-empty (used by status<->risk sync). */
  readonly onRiskFilled?: (riskId: string) => void;
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
};

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

export function RisksSection({
  risks,
  readOnly = false,
  onChange,
  onRiskFilled,
  products,
  stagesForProduct,
  sectionAuthorName,
  addSignal = 0,
}: RisksSectionProps) {
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: "create"; seedProductId?: string }
    | { open: true; mode: "edit"; risk: RiskEntry }
  >({ open: false });
  const [pendingDelete, setPendingDelete] = useState<RiskEntry | null>(null);

  function handleDelete(id: string) {
    if (readOnly) return;
    const risk = risks.find((r) => r.id === id);
    if (!risk) return;
    setPendingDelete(risk);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onChange?.(risks.filter((r) => r.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  function handleEdit(risk: RiskEntry) {
    if (readOnly) return;
    setDialogState({ open: true, mode: "edit", risk });
  }

  function handleDialogSave(
    saved: RiskEntry & { impact: string; mitigation: string },
  ) {
    if (readOnly) return;
    const wasEmpty =
      dialogState.open && dialogState.mode === "edit"
        ? (dialogState.risk.text ?? "").trim().length === 0
        : true;

    if (dialogState.open && dialogState.mode === "create") {
      onChange?.([...risks, saved]);
    } else {
      onChange?.(risks.map((r) => (r.id === saved.id ? saved : r)));
    }

    if (wasEmpty && saved.text.trim().length > 0) {
      onRiskFilled?.(saved.id);
    }
    setDialogState({ open: false });
  }

  function handleDialogCancel() {
    setDialogState({ open: false });
  }

  const firstProductId = products?.[0]?.id;

  useEffect(() => {
    if (addSignal === 0) return;
    if (readOnly) return;
    setDialogState({
      open: true,
      mode: "create",
      seedProductId: firstProductId,
    });
  }, [addSignal, readOnly, firstProductId]);

  return (
    <div className="space-y-4">
      {/* The unbacked-stage warning banner used to live here. It moved
          to the Product Status section (above the SDLC chips) since
          that's where the cause originates — colouring a chip red and
          getting the "describe it" nudge in the same surface reads
          better than asking the lead to scroll down. */}

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
              ? risk.stageIds
              : splitStageNames(risk.stageName);
          // Empty means implicit all assigned stages. A non-empty stageIds
          // array is explicit user scope, even when it contains every stage.
          // Keep every selected stage visible; seven SDLC chips fit better
          // than hiding critical scope behind "+N".
          const stageTagsLabel =
            stageTags.length === 0 ? "All stages" : stageTags.join(", ");
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
                {!locked && (
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                      onClick={() => handleEdit(risk)}
                      aria-label={"Edit risk for " + risk.productName}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                      onClick={() => handleDelete(risk.id)}
                      aria-label={"Delete risk for " + risk.productName}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                )}
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
                  ⚠ Select at least one stage — required for at-risk/blocked products.
                </p>
              )}
              {/* P5: unified [author …… chip] meta-row */}
              <MetaRow
                authorName={risk.authorName ?? sectionAuthorName}
                stageTags={stageTags}
                ariaLabel={"Risk stages: " + stageTagsLabel}
                foreign={risk.foreign === true}
              />
            </div>
          );
        })
      )}

      <RiskEditDialog
        key={`${dialogState.open}-${dialogState.open && dialogState.mode === "edit" ? dialogState.risk.id : "new"}`}
        open={dialogState.open}
        risk={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.risk
            : null
        }
        products={products ?? []}
        defaultProductId={
          dialogState.open && dialogState.mode === "create"
            ? dialogState.seedProductId
            : undefined
        }
        initialImpact={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.risk.impact
            : ""
        }
        initialMitigation={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.risk.mitigation
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
            ? `${pendingDelete.productName}${(pendingDelete.stageIds?.length ? pendingDelete.stageIds : splitStageNames(pendingDelete.stageName)).length > 0 ? ` · ${(pendingDelete.stageIds?.length ? pendingDelete.stageIds : splitStageNames(pendingDelete.stageName)).join(", ")}` : " · all stages"}`
            : undefined
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
