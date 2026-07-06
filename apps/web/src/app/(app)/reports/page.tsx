"use client";

import type { MyHistoryEntry } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { LeadHistoryList } from "../../../features/period/ui/lead-history-list";
import { LeadHistorySidebar } from "../../../features/period/ui/lead-history-sidebar";
import { LeadHistorySkeleton } from "../../../features/period/ui/lead-history-skeleton";
import {
  type HistoryEntry,
  mapCompiledHistoryEntries,
  mapHistoryEntries,
} from "../../../lib/mappers";
import { useSession } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { SearchInput } from "../../../shared/ui/search-input";

/**
 * UX-17 (Phase 35-08): merged Reports page.
 *
 * One role-defaulted history view — lead users get personal History, non-lead
 * users get compiled History. There is no tab state: the page does not read a
 * `tab` query parameter, and the legacy `/lead/history` and `/head/history`
 * routes redirect here without one. Archive visibility is a local, non-URL
 * toggle: History always defaults to the current (non-archived) view and the
 * address bar stays stable when the Archive switch is flipped
 * (lead-live-walk-2026-06-14 §4).
 */

const HISTORY_INITIAL_VISIBLE = 10;

export default function ReportsPage() {
  const { user } = useSession();
  const trpc = useTRPC();

  const role = user?.role ?? null;
  const isLead = role === "lead";
  const usesCompiledHistory =
    role === "head" || role === "viewer" || role === "admin";
  // viewer-report-surface-parity (task 4.1): the viewer searches published,
  // group-scoped content (previously `null` → no search input rendered).
  const searchScope = isLead
    ? "mine"
    : role === "head" || role === "admin"
      ? "all"
      : role === "viewer"
        ? "published"
        : null;

  // History defaults to the current (non-archived) view for every role; the
  // archive toggle is local state only, never derived from the URL.
  const [includeArchive, setIncludeArchive] = useState(false);

  const historyQ = useQuery({
    ...trpc.reports.myHistory.queryOptions(),
    enabled: isLead,
  });

  const compiledHistoryQ = useQuery({
    ...trpc.reports.compiledHistory.queryOptions({ includeArchive }),
    enabled: usesCompiledHistory,
  });

  useEffect(() => {
    if (isLead && historyQ.isError) {
      toast.error(historyQ.error.message);
    }
    if (usesCompiledHistory && compiledHistoryQ.isError) {
      toast.error(compiledHistoryQ.error.message);
    }
  }, [
    compiledHistoryQ.error,
    compiledHistoryQ.isError,
    historyQ.error,
    historyQ.isError,
    isLead,
    usesCompiledHistory,
  ]);

  const allEntries = useMemo(() => {
    const history =
      isLead && Array.isArray(historyQ.data)
        ? (historyQ.data as readonly MyHistoryEntry[])
        : [];
    return mapHistoryEntries(history);
  }, [historyQ.data, isLead]);
  const compiledData = usesCompiledHistory ? compiledHistoryQ.data : undefined;
  const compiledEntries = useMemo(
    () => mapCompiledHistoryEntries(compiledData?.entries ?? []),
    [compiledData?.entries],
  );
  const leadArchiveCount = allEntries.filter((entry) => entry.archived).length;
  const archiveCount = isLead
    ? leadArchiveCount
    : (compiledData?.archiveCount ?? 0);
  const entries = isLead
    ? includeArchive
      ? allEntries
      : allEntries.filter((entry) => !entry.archived)
    : compiledEntries;
  const isLoading = isLead
    ? historyQ.isLoading
    : usesCompiledHistory
      ? compiledHistoryQ.isLoading
      : false;
  const subtitle = isLead
    ? "Your report history."
    : role === "head"
      ? "Compiled group report history."
      : role === "viewer"
        ? "Published report history."
        : "Compiled report history.";
  const summaryTitle = isLead ? "My History Summary" : "History Summary";

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              History
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {subtitle}
            </p>
          </header>

          {role ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-white/75 px-3 py-3">
              <div className="min-w-[220px] flex-1">
                {searchScope ? (
                  <SearchInput
                    scope={searchScope}
                    placeholder={
                      isLead
                        ? "Search my reports…"
                        : role === "viewer"
                          ? "Search published reports…"
                          : "Search reports and products…"
                    }
                  />
                ) : null}
              </div>
              <HistoryArchiveToggle
                checked={includeArchive}
                archiveCount={archiveCount}
                onChange={setIncludeArchive}
              />
            </div>
          ) : (
            <div className="min-h-[44px]" aria-hidden="true" />
          )}

          <HistoryPanel
            entries={entries}
            includeArchive={includeArchive}
            isLoading={isLoading}
            summaryTitle={summaryTitle}
            isLead={isLead}
          />
        </div>
      </div>
    </main>
  );
}

function HistoryPanel({
  entries,
  includeArchive,
  isLoading,
  summaryTitle,
  isLead,
}: {
  readonly entries: HistoryEntry[];
  readonly includeArchive: boolean;
  readonly isLoading: boolean;
  readonly summaryTitle: string;
  readonly isLead: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setShowAll(false);
  }, [includeArchive]);

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
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {includeArchive
                ? "No report history yet."
                : "No current history yet."}
            </p>
          </div>
        )}
        {hasMore && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
              onClick={() => setShowAll(true)}
              aria-label={`Show all ${entries.length} reports`}
            >
              Show all ({entries.length})
            </button>
          </div>
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

function HistoryArchiveToggle({
  checked,
  archiveCount,
  onChange,
}: {
  readonly checked: boolean;
  readonly archiveCount: number;
  readonly onChange: (nextValue: boolean) => void;
}) {
  return (
    <div className="flex min-h-10 shrink-0 items-center">
      <label
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-white px-3 text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] hover:text-[var(--color-starbucks-accent)]"
        title="Past weeks and closed reports"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-starbucks-accent)]"
          aria-label={
            archiveCount > 0
              ? `Show archived reports (${archiveCount})`
              : "Show archived reports"
          }
        />
        <Archive className="h-4 w-4" aria-hidden="true" />
        <span>Archive</span>
        {archiveCount > 0 && (
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[11px] text-[var(--color-starbucks-accent)]">
            {archiveCount}
          </span>
        )}
      </label>
    </div>
  );
}
