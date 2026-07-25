"use client";

import { useState } from "react";

import { LeadHistoryList } from "../../../features/period/ui/lead-history-list";
import { LeadHistorySidebar } from "../../../features/period/ui/lead-history-sidebar";
import { LeadHistorySkeleton } from "../../../features/period/ui/lead-history-skeleton";
import type { HistoryEntry } from "../../../features/report-sections/model/lead-history";

const HISTORY_INITIAL_VISIBLE = 10;

interface HistoryPanelProps {
  readonly entries: HistoryEntry[];
  readonly includeArchive: boolean;
  readonly isLoading: boolean;
  readonly summaryTitle: string;
  readonly isLead: boolean;
}

function HistoryEmptyState({
  includeArchive,
}: {
  readonly includeArchive: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
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

/**
 * History Panel.
 * @param props - The props argument.
 */
export function HistoryPanel({
  entries,
  includeArchive,
  isLoading,
  summaryTitle,
  isLead,
}: HistoryPanelProps) {
  // "Show all" is stored PAIRED with the archive scope it was pressed in, so
  // flipping the scope naturally collapses the list again — no reset effect.
  const [showAllScope, setShowAllScope] = useState<boolean | null>(null);
  const showAll = showAllScope === includeArchive;

  const visibleEntries = showAll
    ? entries
    : entries.slice(0, HISTORY_INITIAL_VISIBLE);
  const hasMore = entries.length > HISTORY_INITIAL_VISIBLE && !showAll;

  if (isLoading) {
    return <LeadHistorySkeleton />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
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
  );
}
