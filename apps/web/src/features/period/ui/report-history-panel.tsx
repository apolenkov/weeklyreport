"use client";

import { COMPILED_HISTORY_LIMIT } from "@weeklyreport/shared";
import { useState } from "react";

import type { HistoryEntry } from "../../report-sections";
import type { HistoryView } from "../model/use-report-history-data";
import { LeadHistoryList } from "./lead-history-list";
import { LeadHistorySidebar } from "./lead-history-sidebar";
import { LeadHistorySkeleton } from "./lead-history-skeleton";

const HISTORY_INITIAL_VISIBLE = 10;

interface HistoryPanelProps {
  readonly entries: readonly HistoryEntry[];
  readonly includeArchive: boolean;
  readonly isLoading: boolean;
  readonly failure: HistoryView["failure"];
  readonly summaryTitle: string;
  readonly isLead: boolean;
  readonly truncated: boolean;
}

function HistoryEmptyState({
  includeArchive,
}: {
  readonly includeArchive: boolean;
}) {
  return (
    <div
      data-testid="history-empty-state"
      className="flex flex-1 items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center"
    >
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {includeArchive ? "No report history yet." : "No current history yet."}
      </p>
    </div>
  );
}

function ShowAllButton({
  total,
  onClick,
}: {
  readonly total: number;
  readonly onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
        onClick={onClick}
        aria-label={`Show all ${total} reports`}
      >
        Show all ({total})
      </button>
    </div>
  );
}

export function HistoryPanel({
  entries,
  includeArchive,
  isLoading,
  failure,
  summaryTitle,
  isLead,
  truncated,
}: HistoryPanelProps) {
  // "Show all" is paired with its archive scope. Switching scope collapses the
  // list; switching back restores that scope's expansion without a reset effect.
  const [showAllScope, setShowAllScope] = useState<boolean | null>(null);
  const showAll = showAllScope === includeArchive;

  const visibleEntries = showAll
    ? entries
    : entries.slice(0, HISTORY_INITIAL_VISIBLE);
  const hasMore = entries.length > HISTORY_INITIAL_VISIBLE && !showAll;

  if (isLoading) return <LeadHistorySkeleton />;

  const errorNotice = failure && (
    <div
      role="alert"
      className="space-y-3 rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-card)] p-4 text-sm"
    >
      <p>
        {entries.length > 0
          ? "History could not be fully loaded. The list and summary show loaded reports only."
          : "History could not be loaded."}
      </p>
      <button
        type="button"
        onClick={failure.retry}
        disabled={failure.isRetrying}
        className="btn-press min-h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 font-semibold disabled:opacity-50"
      >
        {failure.isRetrying ? "Retrying history…" : "Retry history"}
      </button>
    </div>
  );
  if (failure && entries.length === 0) return errorNotice;

  return (
    <div className="space-y-4">
      {errorNotice}
      {truncated && (
        <p
          role="status"
          className="min-w-0 text-sm text-[var(--color-muted-foreground)]"
        >
          Showing the latest {COMPILED_HISTORY_LIMIT} periods.
        </p>
      )}
      <div
        data-testid="history-panel-grid"
        className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div
          data-testid="history-panel-list"
          className="flex min-h-0 flex-col gap-6"
        >
          {entries.length > 0 ? (
            <LeadHistoryList entries={visibleEntries} />
          ) : (
            <HistoryEmptyState includeArchive={includeArchive} />
          )}
          {hasMore && (
            <ShowAllButton
              total={entries.length}
              onClick={() => setShowAllScope(includeArchive)}
            />
          )}
        </div>
        <div className="space-y-4">
          <LeadHistorySidebar
            entries={entries}
            summaryTitle={summaryTitle}
            showStatus
            viewerMode={!isLead}
          />
        </div>
      </div>
    </div>
  );
}
