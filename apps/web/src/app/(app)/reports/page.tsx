'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { LeadHistoryList } from '../../../components/lead/lead-history-list';
import { LeadHistorySidebar } from '../../../components/lead/lead-history-sidebar';
import { LeadHistorySkeleton } from '../../../components/lead/lead-history-skeleton';
import { ReportArchiveSection } from '../../../components/dashboard/report-archive-section';
import { SearchInput } from '../../../components/search/search-input';
import { useSession } from '../../../lib/session-provider';
import { mapHistoryEntries } from '../../../lib/mappers';
import { useTRPC } from '../../../lib/trpc-context';

/**
 * UX-17 (Phase 35-08): merged Reports page.
 *
 * Two tabs: "Мои черновики" (lead-only, the lead's authored sections —
 * includes drafts and submitted) and "Опубликованные" (the archive of
 * published periods, visible to every role).
 *
 * Tab default by role:
 *   - lead              → "Мои черновики"
 *   - head/admin/viewer → "Опубликованные"
 * Override via `?tab=drafts|published`.
 *
 * The legacy `/lead/history` and `/reports/history` routes 307-redirect
 * here with the appropriate tab pre-selected.
 */
type TabId = 'drafts' | 'published';

const HISTORY_INITIAL_VISIBLE = 10;

export default function ReportsPage() {
  const { user } = useSession();
  const searchParams = useSearchParams();

  const role = user?.role ?? null;
  const isLead = role === 'lead';
  const searchScope = isLead
    ? 'mine'
    : role === 'head' || role === 'admin'
      ? 'all'
      : null;

  // Default tab logic mirrors the spec: lead → drafts; everyone else → published.
  const tabFromUrl = searchParams?.get('tab');
  const initialTab: TabId =
    tabFromUrl === 'drafts' || tabFromUrl === 'published'
      ? tabFromUrl
      : isLead
        ? 'drafts'
        : 'published';

  const [tab, setTab] = useState<TabId>(initialTab);

  // Keep state in sync if the URL param changes after mount (e.g. user
  // navigates from /lead/history → 307 → /reports?tab=drafts).
  useEffect(() => {
    if (tabFromUrl === 'drafts' || tabFromUrl === 'published') {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Отчёты
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {isLead
                ? 'Ваши черновики и опубликованные отчёты департамента в одном месте.'
                : 'Архив опубликованных еженедельных отчётов департамента.'}
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)]">
            <TabButton
              label="Мои черновики"
              active={tab === 'drafts'}
              disabled={!isLead}
              onClick={() => setTab('drafts')}
            />
            <TabButton
              label="Опубликованные"
              active={tab === 'published'}
              onClick={() => setTab('published')}
            />
          </div>

          {searchScope && (
            <div>
              <SearchInput
                scope={searchScope}
                placeholder={
                  isLead ? 'Поиск по моим отчётам…' : 'Поиск по отчётам и продуктам…'
                }
              />
            </div>
          )}

          {tab === 'drafts' ? (
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
      aria-current={active ? 'page' : undefined}
      className={`relative -mb-px inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-b-2 border-[var(--color-starbucks-accent)] text-[var(--color-starbucks-accent)]'
          : 'border-b-2 border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
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
        Эта вкладка доступна только тимлидам.
      </p>
      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
        Здесь тимлиды видят свои черновики и отправленные отчёты. Перейдите на
        вкладку «Опубликованные», чтобы посмотреть архив департамента.
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
      toast.error(error?.message ?? 'Не удалось загрузить историю отчётов.');
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
              aria-label={`Показать все ${entries.length} отправлений`}
            >
              Показать все ({entries.length})
            </button>
          </div>
        )}
        {entries.length === 0 && (
          <p className="text-center text-sm text-[var(--color-muted-foreground)]">
            У вас ещё нет отправленных отчётов.
          </p>
        )}
      </div>
      <div className="space-y-4">
        <LeadHistorySidebar entries={entries} />
      </div>
    </div>
  );
}
