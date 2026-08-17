import { Skeleton } from "@customreport/ui/components/ui/skeleton";

const KPI_CARD_COUNT = 3;
const QUEUE_ROW_COUNT = 5;
const BLOCKED_AT_RISK_ROW_COUNT = 5;
const kpiCards = Array.from({ length: KPI_CARD_COUNT }, (_, index) => index);
const queueRows = Array.from({ length: QUEUE_ROW_COUNT }, (_, index) => index);
const blockedRows = Array.from(
  { length: BLOCKED_AT_RISK_ROW_COUNT },
  (_, index) => index,
);

function KpiCardGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {kpiCards.map((index) => (
        <div
          key={index}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5"
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-12 w-32" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="min-w-0 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="grid min-w-0 gap-2 p-3 sm:p-4">
        {queueRows.map((index) => (
          <div
            key={index}
            data-testid="dashboard-queue-skeleton-row"
            className="grid min-h-[4.875rem] min-w-0 items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(11rem,1.3fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_5.5rem_5.5rem]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-32 max-w-full" />
            </span>
            <Skeleton className="h-6 w-24 rounded-[var(--radius-pill)]" />
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-4 w-28 max-w-full" />
            <Skeleton className="h-11 w-[5.5rem] rounded-[var(--radius-pill)]" />
            <Skeleton className="h-11 w-[5.5rem] rounded-[var(--radius-pill)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockedAtRiskSkeleton() {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="space-y-2 px-4 pb-4">
        {blockedRows.map((index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <KpiCardGridSkeleton />
      <QueueSkeleton />
      <Skeleton className="h-12 w-full rounded-[var(--radius)]" />
      <BlockedAtRiskSkeleton />
    </div>
  );
}
