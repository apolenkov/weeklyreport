"use client";

import { type MouseEvent, useState } from "react";

import {
  type LeadSubmitReadiness,
  pendingReviewLabel,
} from "../../../../report-sections";
import { autosaveReadinessCopy } from "./autosave-state-copy";

interface LeadSubmitReadinessSummaryProps {
  readonly readiness: LeadSubmitReadiness;
  readonly onSubmit: () => void;
  readonly showSubmitAction?: boolean | undefined;
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
}: LeadSubmitReadinessSummaryProps) {
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
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {autosaveReadinessCopy(readiness.autosaveState)}
        </p>
      </div>
      {showSubmitAction ? (
        <button
          type="button"
          aria-label="Submit report"
          className="btn-press inline-flex min-h-10 max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-5 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSubmit}
          disabled={!readiness.canOpenConfirmation}
          title={
            readiness.submitPending
              ? "Submission in progress"
              : readiness.blockingIssues[0]?.label
          }
        >
          Submit
        </button>
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
      className="mt-4 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40"
      data-testid="lead-submit-automatic-statuses"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm marker:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]">
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

function findOverviewTarget(focus: string): HTMLElement | undefined {
  return (
    document.getElementById(focus) ??
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-overview-focus]"),
    ).find((element) => element.dataset.overviewFocus === focus)
  );
}

function focusOverviewTarget(target: HTMLElement): void {
  if (target.closest("[hidden], [inert]")) {
    const unit = target.closest("article");
    const expander = Array.from(
      unit?.querySelectorAll<HTMLButtonElement>(
        'button[aria-expanded="false"][aria-controls]',
      ) ?? [],
    ).find((button) => {
      const controlledId = button.getAttribute("aria-controls");
      return controlledId
        ? document.getElementById(controlledId)?.contains(target)
        : false;
    });
    if (expander) {
      expander.click();
      queueMicrotask(() => target.focus());
      return;
    }
  }
  target.focus();
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
    <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-destructive)]/35 bg-[var(--color-destructive-surface-subtle)] p-4">
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
                    const target = findOverviewTarget(focus);
                    if (!target) return;
                    focusOverviewTarget(target);
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
}: LeadSubmitReadinessSummaryProps) {
  return (
    <section
      aria-labelledby="lead-submit-readiness-title"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm"
      data-testid="lead-submit-readiness"
    >
      <ReadinessHeader
        readiness={readiness}
        onSubmit={onSubmit}
        showSubmitAction={showSubmitAction}
      />
      <AutomaticStatusChanges items={readiness.willAutoPromote} />
      <BlockingIssues items={readiness.blockingIssues} />
    </section>
  );
}
