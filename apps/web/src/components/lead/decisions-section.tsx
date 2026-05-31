"use client";

import { useEffect, useState } from "react";

import { LockBadge } from "../report-shell/lock-badge";
import { MetaRow } from "../report-shell/meta-row";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { DecisionEditDialog } from "./decision-edit-dialog";
import type { DecisionEntry, Product } from "./mock-data";
import { splitStageNames } from "./stage-tags";

type DecisionsSectionProps = {
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
   * Display name of the currently signed-in user. Used to (1) seed the
   * Owner field for newly-created decisions, and (2) hide Edit/Delete on
   * decisions whose owner is someone else.
   */
  readonly currentUserName?: string;
  /**
   * 35-04: SDLC stages available to the lead across all assigned projects.
   * Decisions are department-scoped, so the union is the right denominator.
   */
  readonly availableStages?: readonly string[];
  /** R4-B: products the lead is assigned to, passed through to the dialog. */
  readonly products?: readonly Product[];
  readonly defaultProductId?: string;
  readonly addSignal?: number;
};

function isMine(owner: string | undefined, me: string | undefined): boolean {
  if (!me) return true; // No identity yet — be permissive.
  if (!owner) return true; // Unowned rows behave like own.
  // Case- and punctuation-loose match: tolerate trailing punctuation/spacing.
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[.\s]+$/g, "");
  return normalize(owner) === normalize(me);
}

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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  // Render as locale-aware short date so the chip stays compact.
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function DecisionsSection({
  decisions,
  readOnly = false,
  onChange,
  defaultProductName,
  currentUserName,
  availableStages,
  products,
  defaultProductId,
  addSignal = 0,
}: DecisionsSectionProps) {
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; decision: DecisionEntry }
  >({ open: false });
  const [pendingDelete, setPendingDelete] = useState<DecisionEntry | null>(
    null,
  );

  function handleDelete(id: string) {
    if (readOnly) return;
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;
    setPendingDelete(decision);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    onChange?.(decisions.filter((d) => d.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  function handleEdit(decision: DecisionEntry) {
    if (readOnly) return;
    setDialogState({ open: true, mode: "edit", decision });
  }

  function handleDialogSave(saved: DecisionEntry) {
    if (readOnly) return;
    if (dialogState.open && dialogState.mode === "create") {
      onChange?.([
        ...decisions,
        {
          ...saved,
          productName: saved.productName || defaultProductName || "Group",
          stageName: saved.stageName ?? "—",
        },
      ]);
    } else {
      onChange?.(decisions.map((d) => (d.id === saved.id ? saved : d)));
    }
    setDialogState({ open: false });
  }

  function handleDialogCancel() {
    setDialogState({ open: false });
  }

  useEffect(() => {
    if (addSignal === 0) return;
    if (readOnly) return;
    setDialogState({ open: true, mode: "create" });
  }, [addSignal, readOnly]);

  return (
    <div className="space-y-3">
      {decisions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {readOnly
            ? "No decisions reported."
            : "No decisions yet. Use “+ Add Decision” to flag one for the head."}
        </div>
      ) : (
        decisions.map((decision) => {
          const mine = isMine(decision.owner, currentUserName);
          const stageTags =
            decision.stageIds && decision.stageIds.length > 0
              ? decision.stageIds
              : splitStageNames(decision.stageName);
          return (
            <div
              key={decision.id}
              className="rounded-lg p-4"
              style={{
                background: "var(--color-background)",
                opacity: decision.foreign ? 0.7 : 1,
              }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                  {decision.productName}
                </span>
                {decision.deadline && (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#fff7e6] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a6d1b]">
                    Due {formatDeadline(decision.deadline)}
                  </span>
                )}
                {/* Owned-by-someone-else marker — surfaces "this isn't yours
                  to act on" without needing to open the dialog. */}
                {!mine && decision.owner && (
                  <span
                    className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#eef2ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#4338ca]"
                    title={`Owner: ${decision.owner} — read-only for you`}
                  >
                    Owner: {decision.owner}
                  </span>
                )}
                {!readOnly && mine && !decision.foreign ? (
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                      onClick={() => handleEdit(decision)}
                      aria-label={`Edit decision`}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-1.5 text-[rgba(0,0,0,0.4)] transition-colors hover:border-[rgba(200,32,20,0.2)] hover:bg-[rgba(200,32,20,0.1)] hover:text-[var(--color-destructive)]"
                      onClick={() => handleDelete(decision.id)}
                      aria-label={`Delete decision for ${decision.productName}`}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                ) : decision.foreign === true ? (
                  <div className="ml-auto flex gap-1">
                    <LockBadge authorName={decision.owner} />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 text-sm text-[var(--color-foreground)]">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    Decision
                  </span>
                  <div className="mt-0.5 break-words">
                    {decision.text || (
                      <em className="text-[var(--color-muted-foreground)]">
                        — pending
                      </em>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    Impact
                  </span>
                  <div className="mt-0.5 break-words text-[var(--color-muted-foreground)]">
                    {decision.impact || "—"}
                  </div>
                </div>
              </div>
              {/* P5: unified [author …… chip] meta-row */}
              <MetaRow
                authorName={decision.owner}
                stageTags={stageTags}
                ariaLabel={`Decision stages: ${stageTags.length === 0 ? "all stages" : stageTags.join(", ")}`}
                foreign={false}
              />
            </div>
          );
        })
      )}

      <DecisionEditDialog
        key={`${dialogState.open}-${dialogState.open && dialogState.mode === "edit" ? dialogState.decision.id : "new"}`}
        open={dialogState.open}
        decision={
          dialogState.open && dialogState.mode === "edit"
            ? dialogState.decision
            : null
        }
        defaultOwner={currentUserName}
        availableStages={availableStages}
        products={products}
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
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
