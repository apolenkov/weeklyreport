import { Skeleton } from '@customreport/ui/components/ui/skeleton';

type AdminTabSkeletonProps = {
  readonly variant: 'table' | 'form';
};

/**
 * Loading-state skeleton for admin tabs. Matches final UI dimensions to
 * prevent layout shift when the snapshot query resolves.
 *
 * - 'table' renders a 5-column header row with 6 body rows of skeleton cells,
 *   matching Users / Products / Periods / Reminders tabs.
 * - 'form' renders 4 stacked label+input skeletons matching SettingsTab.
 */
export function AdminTabSkeleton({ variant }: AdminTabSkeletonProps) {
  if (variant === 'form') {
    return (
      <div className="max-w-lg space-y-5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-32 rounded-[var(--radius-pill)]" />
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--color-border)]">
        {/* Header row */}
        <div className="grid grid-cols-5 gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
          {[0, 1, 2, 3, 4].map((col) => (
            <Skeleton key={col} className="h-4 w-24" />
          ))}
        </div>
        {/* Body rows */}
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="grid grid-cols-5 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
          >
            {[0, 1, 2, 3, 4].map((col) => (
              <Skeleton key={col} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
