"use client";

import { type MouseEvent, useId, useState } from "react";

import { useIsOnline } from "../../../../../shared/lib/query/use-is-online";
import {
  type LeadSubmitReadiness,
  pendingReviewLabel,
} from "../../../../report-sections";
import { autosaveReadinessCopy } from "./autosave-state-copy";
import { focusCompletionIssue } from "./overview-completion-focus";

interface LeadSubmitReadinessSummaryProps {
  readonly readiness: LeadSubmitReadiness;
  readonly onSubmit: () => void;
  readonly showSubmitAction?: boolean | undefined;
  readonly showAutosaveStatus?: boolean | undefined;
}

type Promotion = LeadSubmitReadiness["willAutoPromote"][number];

const PROMOTION_GROUPS = [
  { kind: "product", title: "Products" },
  { kind: "activity", title: "Activities" },
  { kind: "stage", title: "Stages" },
] as const;

function readinessStatusCopy(readiness: LeadSubmitReadiness): string {
  if (readiness.submitPending) return "Submitting report…";
  if (readiness.blockingIssues.length > 0) {
    const guidance = "Complete the items below before submitting.";
    return readiness.pendingReviewCount > 0
      ? `${pendingReviewLabel(readiness.pendingReviewCount)}. ${guidance}`
      : guidance;
  }
  return "This report is ready to submit.";
}

function ReadinessHeader({
  readiness,
  onSubmit,
  showSubmitAction,
  showAutosaveStatus = true,
}: LeadSubmitReadinessSummaryProps) {
  // The same onlineManager signal useSaveStatus uses, so the paragraph cannot
  // claim a save is in flight while the status line reports it paused.
  const online = useIsOnline();
  const reasonId = useId();
  const reason = readiness.submitPending
    ? "Submitting report…"
    : readiness.blockingIssues[0]?.label;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2
          id="lead-submit-readiness-title"
          className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
        >
          Before you submit
        </h2>
        <p className="mt-1 text-sm font-semibold" role="status">
          {readinessStatusCopy(readiness)}
        </p>
        {showAutosaveStatus ? (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {autosaveReadinessCopy(readiness.autosaveState, online)}
          </p>
        ) : null}
      </div>
      {showSubmitAction ? (
        <div className="min-w-0 max-w-full sm:max-w-sm">
          <button
            type="button"
            aria-label="Submit report"
            className="btn-press inline-flex min-h-10 max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-5 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSubmit}
            disabled={!readiness.canOpenConfirmation}
            aria-describedby={
              !readiness.canOpenConfirmation && reason ? reasonId : undefined
            }
          >
            Submit
          </button>
          {!readiness.canOpenConfirmation && reason ? (
            <p
              id={reasonId}
              data-testid="lead-summary-disabled-reason"
              className="mt-2 break-words text-sm text-[var(--color-muted-foreground)]"
            >
              {reason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PromotionGroup({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly Promotion[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title} ({items.length})
      </h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-foreground)]">
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}

function AutomaticStatusChanges({
  items,
}: {
  readonly items: LeadSubmitReadiness["willAutoPromote"];
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const statusLabel = items.length === 1 ? "status" : "statuses";
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="mt-2 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40"
      data-testid="lead-submit-automatic-statuses"
    >
      <summary className="min-h-[var(--touch-target-min)] cursor-pointer px-4 py-2 text-sm marker:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]">
        <span className="font-semibold text-[var(--color-foreground)]">
          When you submit:
        </span>{" "}
        <span className="text-[var(--color-muted-foreground)]">
          {items.length} unset {statusLabel} will be marked On Track when
          submitted.
        </span>
      </summary>
      <div className="grid max-h-64 gap-4 overflow-y-auto border-t border-[var(--color-border-subtle)] px-4 py-3 md:grid-cols-3">
        {PROMOTION_GROUPS.map((group) => (
          <PromotionGroup
            key={group.kind}
            title={group.title}
            items={items.filter((item) => item.kind === group.kind)}
          />
        ))}
      </div>
    </details>
  );
}

function isModifiedNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function BlockingIssues({
  items,
}: {
  readonly items: LeadSubmitReadiness["blockingIssues"];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 rounded-[var(--radius)] border border-[var(--color-destructive)]/35 bg-[var(--color-destructive-surface-subtle)] p-3">
      <h3 className="text-sm font-semibold text-[var(--color-destructive)]">
        Fix before submitting
      </h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-foreground)]">
        {items.map((item) => {
          const focus = item.overviewFocus;
          return (
            <li key={item.id}>
              {focus ? (
                <a
                  href={`#${focus}`}
                  onClick={(event) => {
                    if (isModifiedNavigation(event)) return;
                    focusCompletionIssue(focus);
                  }}
                  className="rounded-[var(--radius-sm)] font-semibold text-[var(--color-primary)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  {item.label}
                </a>
              ) : (
                item.label
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LeadSubmitReadinessSummary({
  readiness,
  onSubmit,
  showSubmitAction,
  showAutosaveStatus = true,
}: LeadSubmitReadinessSummaryProps) {
  return (
    <section
      aria-labelledby="lead-submit-readiness-title"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-sm"
      data-testid="lead-submit-readiness"
    >
      <ReadinessHeader
        readiness={readiness}
        onSubmit={onSubmit}
        showSubmitAction={showSubmitAction}
        showAutosaveStatus={showAutosaveStatus}
      />
      <AutomaticStatusChanges items={readiness.willAutoPromote} />
      <BlockingIssues items={readiness.blockingIssues} />
    </section>
  );
}
