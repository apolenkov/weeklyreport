"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import type { MyHistoryEntry } from "@customreport/shared";

import { LeadHistoryList } from "../../../components/lead/lead-history-list";
import { LeadHistorySidebar } from "../../../components/lead/lead-history-sidebar";
import { LeadHistorySkeleton } from "../../../components/lead/lead-history-skeleton";
import { ReportArchiveSection } from "../../../components/dashboard/report-archive-section";
import { SearchInput } from "../../../components/search/search-input";
import { useSession } from "../../../lib/session-provider";
import { mapHistoryEntries, type HistoryEntry } from "../../../lib/mappers";
import { useTRPC } from "../../../lib/trpc-context";

/**
 * UX-17 (Phase 35-08): merged Reports page.
 *
 * Lead users get a single History list. The legacy `?tab=published` URL is
 * treated as "include archive" so old links still reveal archived periods.
 * Non-lead roles keep the compiled archived report list on the same route.
 */

const HISTORY_INITIAL_VISIBLE = 10;

export default function ReportsPage() {
  const { user } = useSession();
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = user?.role ?? null;
  const isLead = role === "lead";
  const searchScope = isLead
    ? "mine"
    : role === "head" || role === "admin"
      ? "all"
      : null;

  const tabFromUrl = searchParams?.get("tab");
  const [includeArchive, setIncludeArchive] = useState(
    tabFromUrl === "published",
  );

  function toggleArchive(nextValue: boolean) {
    setIncludeArchive(nextValue);
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", nextValue ? "published" : "drafts");
    router.push(`/reports?${params.toString()}`, { scroll: false });
  }

  // Keep state in sync if the URL param changes after mount (e.g. user
  // navigates from /reports/history -> /reports?tab=published).
  useEffect(() => {
    setIncludeArchive(tabFromUrl === "published");
  }, [tabFromUrl]);

  const historyQ = useQuery({
    ...trpc.reports.myHistory.queryOptions(),
    enabled: isLead,
  });

  useEffect(() => {
    if (isLead && historyQ.isError) {
      toast.error(historyQ.error?.message ?? "Failed to load report history.");
    }
  }, [isLead, historyQ.isError, historyQ.error]);

  const allEntries = useMemo(() => {
    const history =
      isLead && Array.isArray(historyQ.data)
        ? (historyQ.data as readonly MyHistoryEntry[])
        : [];
    return mapHistoryEntries(history);
  }, [historyQ.data, isLead]);
  const archiveCount = allEntries.filter((entry) => entry.archived).length;
  const entries = includeArchive
    ? allEntries
    : allEntries.filter((entry) => !entry.archived);

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
              {isLead ? "Your report history." : "Archived report history."}
            </p>
          </header>

          {searchScope ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <SearchInput
                  scope={searchScope}
                  placeholder={
                    isLead
                      ? "Search my reports…"
                      : "Search reports and products…"
                  }
                />
              </div>
              {isLead && (
                <HistoryArchiveToggle
                  checked={includeArchive}
                  archiveCount={archiveCount}
                  onChange={toggleArchive}
                />
              )}
            </div>
          ) : (
            <div className="min-h-[44px]" aria-hidden="true" />
          )}

          {isLead ? (
            <LeadHistoryPanel
              entries={entries}
              includeArchive={includeArchive}
              isLoading={historyQ.isLoading}
            />
          ) : (
            <ReportArchiveSection />
          )}
        </div>
      </div>
    </main>
  );
}

function LeadHistoryPanel({
  entries,
  includeArchive,
  isLoading,
}: {
  readonly entries: HistoryEntry[];
  readonly includeArchive: boolean;
  readonly isLoading: boolean;
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
          summaryTitle="My History Summary"
          showStatus
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
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.12)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]">
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
        <span>Show archive</span>
        {archiveCount > 0 && (
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2 py-0.5 text-[11px] text-[var(--color-starbucks-accent)]">
            {archiveCount}
          </span>
        )}
      </label>
    </div>
  );
}
