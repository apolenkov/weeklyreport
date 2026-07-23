"use client";

import type { Ref } from "react";

import { isLead } from "../../../lib/role-predicates";
import { DocumentActionGroup } from "../../../shared/ui/report-shell/report-toolbar";
import { VersionComingSoonControl } from "../../admin";
import { PdfExportComingSoonControl } from "../../pdf-export";
import { FillFromButton } from "../../period";
import {
  type LeadCompletionActionContract,
  LeadCompletionActions,
} from "./lead-completion-actions";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";

/** The dialog-lifecycle slice the page header drives. */
export interface LeadFormHeaderWriteActions {
  readonly fillFromMut: { readonly isPending: boolean };
  readonly handleFillFrom: (sourceSectionId: string) => void;
  readonly requestReopenMut: { readonly isPending: boolean };
  readonly openReopenDialog: () => void;
  readonly revokeMut: { readonly isPending: boolean };
  readonly handleRevoke: () => void;
}

interface LeadFormHeaderActionsProps {
  readonly viewModel: LeadFormLoadedViewModel;
  readonly writeActions: LeadFormHeaderWriteActions;
  readonly completionActions: LeadCompletionActionContract;
  readonly completionSentinelRef: Ref<HTMLDivElement>;
  readonly showCompletionActions: boolean;
  readonly isSlidesMode: boolean;
  readonly isSubmitted: boolean;
}

/**
 * The lead form's page header: title, submitted/autosave badge, and the
 * contextual document actions. Save/Add/Submit use the shared completion
 * presentation so the observed sticky handoff cannot fork action state.
 */
export function LeadFormHeaderActions({
  viewModel,
  writeActions,
  completionActions,
  completionSentinelRef,
  showCompletionActions,
  isSlidesMode,
  isSubmitted,
}: LeadFormHeaderActionsProps) {
  const {
    canRequestReopen,
    currentUser,
    fillFromLocked,
    isReadOnly,
    visiblePeriods,
  } = viewModel;
  const { autosave } = completionActions;

  // Autosave indicator label — 4-state badge.
  const autosaveLabel =
    autosave.state === "saving"
      ? "↻ Saving…"
      : autosave.state === "pending"
        ? "● Pending…"
        : autosave.state === "saved" && autosave.lastSavedAt
          ? autosave.lastSavedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : autosave.state === "error"
            ? "⚠ Save failed"
            : "Autosaved";

  // The badge shares the green success treatment for every non-error state; an
  // error must not read as a success, so it takes a destructive variant.
  const autosaveBadgeClassName =
    autosave.state === "error"
      ? "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]"
      : "bg-[var(--color-success)] text-[var(--color-primary)]";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            My Report
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Your report draft and status context.
          </p>
        </div>
        {/* Submitted state uses the .b-ok variant (light teal bg + dark
            teal text) — matches mockup s2 rather than the heavier
            white-on-dark-teal `.b-done` look that read as a destructive
            "locked" signal. */}
        {!isSlidesMode &&
          (isSubmitted ? (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)]">
              ✓ Submitted
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold ${autosaveBadgeClassName}`}
            >
              {autosaveLabel}
            </span>
          ))}
      </div>
      {/* Document actions live on the header line's right slot, not inside
          the bordered toolbar. A read-only past period hides the real
          mutating actions (Save/Submit/Fill-From) while the inert
          Coming-soon stubs remain. Submit is the single brand-green
          forward primary; reversal actions (Request Reopen / Revoke) stay
          neutral/outline so green keeps one "forward, safe-to-commit"
          meaning. */}
      <DocumentActionGroup>
        <VersionComingSoonControl />
        {/* TODO(lead-pdf-export): lead is excluded from pdfExport
            (role-coverage-gate); this inert ComingSoon control never
            reaches a backend call. */}
        <PdfExportComingSoonControl />
        {!isReadOnly && (
          <FillFromButton
            periods={visiblePeriods}
            disabled={writeActions.fillFromMut.isPending}
            lockedReason={
              fillFromLocked
                ? "Fill from previous cannot replace records that are part of the published report."
                : undefined
            }
            onFillFrom={writeActions.handleFillFrom}
          />
        )}
        {/* The control is driven by the server-computed `canRequestReopen`
            flag — hidden when the period is published/archived or a request
            is already pending. The client does NOT reconstruct the lifecycle
            policy. */}
        {isSubmitted && isLead(currentUser.authorRole) && canRequestReopen && (
          <button
            type="button"
            className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={writeActions.openReopenDialog}
            disabled={writeActions.requestReopenMut.isPending}
            title="Ask Head to unlock this section"
          >
            Request Reopen
          </button>
        )}
        {isSubmitted && !isLead(currentUser.authorRole) && (
          <button
            type="button"
            className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={writeActions.handleRevoke}
            disabled={writeActions.revokeMut.isPending}
            title="Revoke submission and unlock the section"
          >
            Revoke
          </button>
        )}
        <div ref={completionSentinelRef} className="min-h-px min-w-px">
          {!isReadOnly && showCompletionActions && (
            <LeadCompletionActions
              {...completionActions}
              label="Header completion actions"
            />
          )}
        </div>
      </DocumentActionGroup>
    </header>
  );
}
