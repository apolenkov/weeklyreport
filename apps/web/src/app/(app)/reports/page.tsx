"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { LeadHistoryList } from "../../../components/lead/lead-history-list";
import { LeadHistorySidebar } from "../../../components/lead/lead-history-sidebar";
import { LeadHistorySkeleton } from "../../../components/lead/lead-history-skeleton";
import { ReportArchiveSection } from "../../../components/dashboard/report-archive-section";
import { SearchInput } from "../../../components/search/search-input";
import { useSession } from "../../../lib/session-provider";
import { mapHistoryEntries } from "../../../lib/mappers";
import { useTRPC } from "../../../lib/trpc-context";

/**
 * UX-17 (Phase 35-08): merged Reports page.
 *
 * Two tabs: "My Drafts" (lead-only, the lead's authored sections —
 * includes drafts and submitted) and "Published" (the archive of
 * published periods, visible to every role).
 *
 * Tab default by role:
 *   - lead              → "My Drafts"
 *   - head/admin/viewer → "Published"
 * Override via `?tab=drafts|published`.
 *
 * The legacy `/lead/history` and `/reports/history` routes 307-redirect
 * here with the appropriate tab pre-selected.
 */
type TabId = "drafts" | "published";

const HISTORY_INITIAL_VISIBLE = 10;

export default function ReportsPage() {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = user?.role ?? null;
  const isLead = role === "lead";
  const searchScope = isLead
    ? "mine"
    : role === "head" || role === "admin"
      ? "all"
      : null;

  // Default tab logic mirrors the spec: lead → drafts; everyone else → published.
  const tabFromUrl = searchParams?.get("tab");
  const initialTab: TabId =
    tabFromUrl === "drafts" || tabFromUrl === "published"
      ? tabFromUrl
      : isLead
        ? "drafts"
        : "published";

  const [tab, setTab] = useState<TabId>(initialTab);

  function selectTab(nextTab: TabId) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", nextTab);
    router.push(`/reports?${params.toString()}`, { scroll: false });
  }

  // Keep state in sync if the URL param changes after mount (e.g. user
  // navigates from /lead/history → 307 → /reports?tab=drafts).
  useEffect(() => {
    if (tabFromUrl === "drafts" || tabFromUrl === "published") {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Reports
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {isLead
                ? "Your drafts and published group reports in one place."
                : "Published group report archive."}
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)]">
            <TabButton
              label="My Drafts"
              active={tab === "drafts"}
              disabled={!isLead}
              onClick={() => selectTab("drafts")}
            />
            <TabButton
              label="Published"
              active={tab === "published"}
              onClick={() => selectTab("published")}
            />
          </div>

          {searchScope ? (
            <div>
              <SearchInput
                scope={searchScope}
                placeholder={
                  isLead ? "Search my reports…" : "Search reports and products…"
                }
              />
            </div>
          ) : (
            <div className="min-h-[44px]" aria-hidden="true" />
          )}

          {tab === "drafts" ? (
            isLead ? (
              <LeadDraftsPanel />
            ) : (
              <EmptyDraftsForNonLead />
            )
          ) : (
            <ReportArchiveSection />
          )}
        </div>
      </div>
    </main>
  );
}

function TabButton({
  label,
  active,
  onClick,
  disabled,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={`relative -mb-px inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-b-2 border-[var(--color-starbucks-accent)] text-[var(--color-starbucks-accent)]"
          : "border-b-2 border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyDraftsForNonLead() {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
      <p className="text-sm font-semibold text-[var(--color-foreground)]">
        This tab is available to leads only.
      </p>
      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
        Leads see their drafts and submitted reports here. Open Published to
        view the group archive.
      </p>
    </div>
  );
}

function LeadDraftsPanel() {
  const trpc = useTRPC();
  const { data, isLoading, isError, error } = useQuery(
    trpc.reports.myHistory.queryOptions(),
  );
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (isError) {
      toast.error(error?.message ?? "Failed to load report history.");
    }
  }, [isError, error]);

  const entries = useMemo(() => (data ? mapHistoryEntries(data) : []), [data]);
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
        <LeadHistoryList entries={visibleEntries} />
        {hasMore && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
              onClick={() => setShowAll(true)}
              aria-label={`Show all ${entries.length} submissions`}
            >
              Show all ({entries.length})
            </button>
          </div>
        )}
        {entries.length === 0 && (
          <p className="text-center text-sm text-[var(--color-muted-foreground)]">
            You have no submitted reports yet.
          </p>
        )}
      </div>
      <div className="space-y-4">
        <LeadHistorySidebar entries={entries} />
      </div>
    </div>
  );
}
