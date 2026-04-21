'use client';

import { Calendar, CheckCircle2, Clock, FileText } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
} from '@customreport/ui';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { SectionCardSkeleton, PageTitleSkeleton } from '../../../../components/common/page-skeleton';
import { EmptyState } from '../../../../components/common/empty-state';

function formatPeriod(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt.format(start)} — ${fmt.format(end)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getMonthKey(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

type HistoryEntry = {
  sectionId: string;
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  reportStatus: string;
  sectionStatus: string;
  submittedAt: Date | null;
  publishedAt: Date | null;
};

function HistorySkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageTitleSkeleton />
      <SectionCardSkeleton />
      <SectionCardSkeleton />
    </div>
  );
}

export default function LeadHistoryPage() {
  const historyQuery = trpc.reports.myHistory.useQuery();

  if (historyQuery.isLoading) {
    return (
      <AppShell role="lead" currentPath="/lead/history">
        <HistorySkeleton />
      </AppShell>
    );
  }

  if (historyQuery.error) {
    return (
      <AppShell role="lead" currentPath="/lead/history">
        <QueryError error={historyQuery.error} onRetry={() => historyQuery.refetch()} />
      </AppShell>
    );
  }

  const entries: HistoryEntry[] = historyQuery.data ?? [];

  if (entries.length === 0) {
    return (
      <AppShell role="lead" currentPath="/lead/history">
        <EmptyState
          icon={FileText}
          title="No report history"
          description="Your past report sections will appear here once you start submitting reports."
        />
      </AppShell>
    );
  }

  // Group by month
  const grouped = entries.reduce<Record<string, HistoryEntry[]>>((acc, entry) => {
    const key = getMonthKey(entry.periodStart);
    const group = acc[key] ?? [];
    group.push(entry);
    acc[key] = group;
    return acc;
  }, {});

  return (
    <AppShell role="lead" currentPath="/lead/history">
      <div className="animate-fade-in space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">My History</h1>
          <p className="text-base text-muted-foreground">
            Past report sections grouped by month
          </p>
        </div>

        {Object.entries(grouped).map(([month, items]) => (
          <div key={month} className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{month}</h2>
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </div>
            <div className="stagger-children space-y-3">
              {items.map((entry) => (
                <Card
                  key={entry.sectionId}
                  className="transition-colors hover:border-primary/20 hover:bg-primary/[0.02]"
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPeriod(entry.periodStart, entry.periodEnd)}
                        </span>
                        <Badge
                          variant={entry.sectionStatus === 'submitted' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {entry.sectionStatus === 'submitted' ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" /> Submitted</>
                          ) : (
                            <><Clock className="mr-1 h-3 w-3" /> Draft</>
                          )}
                        </Badge>
                        {entry.reportStatus === 'published' ? (
                          <Badge variant="secondary" className="text-xs">Published</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.submittedAt
                          ? `Submitted ${formatDate(entry.submittedAt)}`
                          : 'Not yet submitted'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
