"use client";

import {
  Circle,
  CircleCheck,
  type LucideIcon,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { Ref } from "react";

import { isLead } from "../../../../../shared/lib/auth/role-predicates";
import { ReportBreadcrumb } from "../../../../../shared/ui/report-shell/report-breadcrumb";
import { DocumentActionGroup } from "../../../../../shared/ui/report-shell/report-toolbar";
import { FillFromButton } from "../../../../period";
import type { LeadFormLoadedViewModel } from "../../../../report-sections";
import {
  type LeadCompletionActionContract,
  LeadCompletionActions,
} from "./lead-completion-actions";
import { OfflineSaveNotice } from "./offline-save-notice";

export interface LeadFormHeaderWriteActions {
  readonly fillFromPending: boolean;
  readonly handleFillFrom: (sourceSectionId: string) => void;
  readonly reopenPending: boolean;
  readonly openReopenDialog: () => void;
  readonly revokePending: boolean;
  readonly handleRevoke: () => void;
}

interface LeadFormHeaderActionsProps {
  readonly pendingInput?: boolean | undefined;
  readonly viewModel: LeadFormLoadedViewModel;
  readonly writeActions: LeadFormHeaderWriteActions;
  readonly completionActions: LeadCompletionActionContract;
  readonly completionSentinelRef: Ref<HTMLDivElement>;
  readonly showCompletionActions: boolean;
  readonly isSlidesMode: boolean;
  readonly isForeignSlidesDeck: boolean;
  readonly isSubmitted: boolean;
  readonly periodLabel?: string | undefined;
  // False where the page already announces autosave in its own live region.
  readonly announceAutosave?: boolean | undefined;
}

type HeaderAutosave = LeadCompletionActionContract["autosave"];

const FILL_FROM_LOCKED_REASON =
  "Fill from previous cannot replace records that are part of the published report.";

// Decorative state icons are aria-hidden so screen readers get the words only.
const AUTOSAVE_ICON: Partial<Record<HeaderAutosave["state"], LucideIcon>> = {
  saving: RefreshCw,
  pending: Circle,
  error: TriangleAlert,
};

function formatAutosaveLabel(autosave: HeaderAutosave): string {
  if (autosave.state === "saving") return "Saving…";
  if (autosave.state === "pending") return "Pending…";
  if (autosave.state === "error") return "Save failed";
  if (autosave.state === "saved" && autosave.lastSavedAt) {
    return `Saved ${autosave.lastSavedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return "Autosaved";
}

// The badge shares the green success treatment for every non-error state; an
// error must not read as a success, so it takes a destructive variant.
function AutosaveBadge({
  autosave,
  announce,
}: {
  readonly autosave: HeaderAutosave;
  readonly announce: boolean;
}) {
  const toneClassName =
    autosave.state === "error"
      ? "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]"
      : "bg-[var(--color-success)] text-[var(--color-primary)]";

  const Icon = AUTOSAVE_ICON[autosave.state];

  // A stable role keeps error announcements from re-announcing on a role switch.
  return (
    <span
      role={announce ? "status" : undefined}
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-semibold ${toneClassName}`}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
      {formatAutosaveLabel(autosave)}
    </span>
  );
}

function ReportTitleBlock({
  periodLabel,
  isReadOnly,
}: {
  readonly periodLabel?: string | undefined;
  readonly isReadOnly: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ReportBreadcrumb label={periodLabel ?? "My Report"} />
      <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
        My Report
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {isReadOnly
          ? "Read-only report and status context."
          : "Your report draft and status context."}
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
  hasPendingReopen,
  writeActions,
}: {
  readonly authorRole: LeadFormLoadedViewModel["currentUser"]["authorRole"];
  readonly canRequestReopen: boolean;
  readonly hasPendingReopen: boolean;
  readonly writeActions: LeadFormHeaderWriteActions;
}) {
  if (!isLead(authorRole)) {
    return (
      <ToolbarSecondaryButton
        label="Revoke"
        title="Revoke submission and unlock the section"
        onClick={writeActions.handleRevoke}
        disabled={writeActions.revokePending}
      />
    );
  }
  if (hasPendingReopen) {
    return (
      <span
        role="status"
        className="inline-flex h-[var(--toolbar-control-h)] items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-4 text-sm font-semibold text-[var(--color-muted-foreground)]"
      >
        Reopen requested
      </span>
    );
  }
  if (!canRequestReopen) return null;
  return (
    <ToolbarSecondaryButton
      label="Request reopen"
      title="Ask Head to unlock this section"
      onClick={writeActions.openReopenDialog}
      disabled={writeActions.reopenPending}
    />
  );
}

function HeaderStatusBadge({
  isSubmitted,
  isReadOnly,
  autosave,
  pendingInput,
  announceAutosave,
}: {
  readonly pendingInput?: boolean | undefined;
  readonly announceAutosave: boolean;
  readonly isSubmitted: boolean;
  readonly isReadOnly: boolean;
  readonly autosave: HeaderAutosave;
}) {
  if (pendingInput) {
    return (
      <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
        Unsaved update
      </span>
    );
  }
  // Light-teal success badge reads as progress, not a locked signal.
  if (isSubmitted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)]">
        <CircleCheck aria-hidden="true" className="size-3" />
        Submitted
      </span>
    );
  }
  if (isReadOnly) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
        Read-only
      </span>
    );
  }
  return <AutosaveBadge autosave={autosave} announce={announceAutosave} />;
}

// Mutating actions hide on read-only; green stays the sole forward primary.
function HeaderActionToolbar({
  viewModel,
  writeActions,
  completionActions,
  completionSentinelRef,
  showCompletionActions,
  isForeignSlidesDeck,
  isSubmitted,
}: Omit<LeadFormHeaderActionsProps, "isSlidesMode">) {
  const {
    canRequestReopen,
    hasPendingReopen,
    currentUser,
    archivedHidden,
    fillFromLocked,
    isReadOnly,
    visiblePeriods,
  } = viewModel;
  const canEditDraft = !isReadOnly && !isForeignSlidesDeck;
  const canMutateSubmittedSection = isSubmitted && !isForeignSlidesDeck;

  return (
    <DocumentActionGroup>
      {canEditDraft && (
        <FillFromButton
          periods={visiblePeriods}
          archivedHidden={archivedHidden}
          disabled={writeActions.fillFromPending}
          lockedReason={fillFromLocked ? FILL_FROM_LOCKED_REASON : undefined}
          onFillFrom={writeActions.handleFillFrom}
        />
      )}
      {canMutateSubmittedSection && (
        <SubmittedSectionAction
          authorRole={currentUser.authorRole}
          canRequestReopen={canRequestReopen}
          hasPendingReopen={hasPendingReopen}
          writeActions={writeActions}
        />
      )}
      <div ref={completionSentinelRef} className="min-h-px min-w-px">
        {canEditDraft && showCompletionActions && (
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
    <header
      data-layout-key="lead-report-header"
      data-layout-stability="position-size"
      className="flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ReportTitleBlock
          periodLabel={header.periodLabel}
          isReadOnly={header.viewModel.isReadOnly}
        />
        {!isSlidesMode && (header.announceAutosave ?? true) && (
          <OfflineSaveNotice
            saving={header.completionActions.autosave.isInFlight}
          />
        )}
        {!isSlidesMode && (
          <HeaderStatusBadge
            isSubmitted={header.isSubmitted}
            isReadOnly={header.viewModel.isReadOnly}
            autosave={header.completionActions.autosave}
            pendingInput={header.pendingInput}
            announceAutosave={header.announceAutosave ?? true}
          />
        )}
      </div>
      <fieldset disabled={header.pendingInput} className="min-w-0 border-0 p-0">
        <legend className="sr-only">Report actions</legend>
        <HeaderActionToolbar {...header} />
        {header.pendingInput ? (
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Save or cancel the open update before using report actions.
          </p>
        ) : null}
      </fieldset>
    </header>
  );
}
