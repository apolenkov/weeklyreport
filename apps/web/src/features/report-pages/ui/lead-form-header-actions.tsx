"use client";

import type { Ref } from "react";

import { isLead } from "../../../shared/lib/auth/role-predicates";
import { DocumentActionGroup } from "../../../shared/ui/report-shell/report-toolbar";
import { VersionComingSoonControl } from "../../admin";
import { PdfExportComingSoonControl } from "../../pdf-export";
import { FillFromButton } from "../../period";
import {
  type LeadCompletionActionContract,
  LeadCompletionActions,
} from "./lead-completion-actions";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";

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

type HeaderAutosave = LeadCompletionActionContract["autosave"];

const FILL_FROM_LOCKED_REASON =
  "Fill from previous cannot replace records that are part of the published report.";

function formatAutosaveLabel(autosave: HeaderAutosave): string {
  if (autosave.state === "saving") return "↻ Saving…";
  if (autosave.state === "pending") return "● Pending…";
  if (autosave.state === "error") return "⚠ Save failed";
  if (autosave.state === "saved" && autosave.lastSavedAt) {
    return autosave.lastSavedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "Autosaved";
}

// The badge shares the green success treatment for every non-error state; an
// error must not read as a success, so it takes a destructive variant.
function AutosaveBadge({ autosave }: { readonly autosave: HeaderAutosave }) {
  const toneClassName =
    autosave.state === "error"
      ? "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]"
      : "bg-[var(--color-success)] text-[var(--color-primary)]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold ${toneClassName}`}
    >
      {formatAutosaveLabel(autosave)}
    </span>
  );
}

function ReportTitleBlock() {
  return (
    <div className="min-w-0">
      <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
        My Report
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Your report draft and status context.
      </p>
    </div>
  );
}

function ToolbarSecondaryButton({
  label,
  title,
  disabled,
  onClick,
}: {
  readonly label: string;
  readonly title: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

// A lead can only ask the Head to unlock; head/admin revoke directly. Both
// gates are server-computed — the client never rebuilds the policy.
function SubmittedSectionAction({
  authorRole,
  canRequestReopen,
  writeActions,
}: {
  readonly authorRole: LeadFormLoadedViewModel["currentUser"]["authorRole"];
  readonly canRequestReopen: boolean;
  readonly writeActions: LeadFormHeaderWriteActions;
}) {
  if (!isLead(authorRole)) {
    return (
      <ToolbarSecondaryButton
        label="Revoke"
        title="Revoke submission and unlock the section"
        onClick={writeActions.handleRevoke}
        disabled={writeActions.revokeMut.isPending}
      />
    );
  }
  if (!canRequestReopen) return null;
  return (
    <ToolbarSecondaryButton
      label="Request Reopen"
      title="Ask Head to unlock this section"
      onClick={writeActions.openReopenDialog}
      disabled={writeActions.requestReopenMut.isPending}
    />
  );
}

function HeaderStatusBadge({
  isSubmitted,
  autosave,
}: {
  readonly isSubmitted: boolean;
  readonly autosave: HeaderAutosave;
}) {
  // Light-teal success badge reads as progress, not a locked signal.
  if (isSubmitted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)]">
        ✓ Submitted
      </span>
    );
  }
  return <AutosaveBadge autosave={autosave} />;
}

// Mutating actions hide on read-only; green stays the sole forward primary.
function HeaderActionToolbar({
  viewModel,
  writeActions,
  completionActions,
  completionSentinelRef,
  showCompletionActions,
  isSubmitted,
}: Omit<LeadFormHeaderActionsProps, "isSlidesMode">) {
  const {
    canRequestReopen,
    currentUser,
    fillFromLocked,
    isReadOnly,
    visiblePeriods,
  } = viewModel;

  return (
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
          lockedReason={fillFromLocked ? FILL_FROM_LOCKED_REASON : undefined}
          onFillFrom={writeActions.handleFillFrom}
        />
      )}
      {isSubmitted && (
        <SubmittedSectionAction
          authorRole={currentUser.authorRole}
          canRequestReopen={canRequestReopen}
          writeActions={writeActions}
        />
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
  );
}

// Shared completion presentation so sticky handoff cannot fork action state.
export function LeadFormHeaderActions({
  isSlidesMode,
  ...header
}: LeadFormHeaderActionsProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ReportTitleBlock />
        {!isSlidesMode && (
          <HeaderStatusBadge
            isSubmitted={header.isSubmitted}
            autosave={header.completionActions.autosave}
          />
        )}
      </div>
      <HeaderActionToolbar {...header} />
    </header>
  );
}
