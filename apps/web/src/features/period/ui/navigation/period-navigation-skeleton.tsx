import { Skeleton } from "@weeklyreport/ui/components/ui/skeleton";

export function PeriodNavigationSkeleton({
  testId,
}: {
  readonly testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex min-w-0 max-w-full basis-full items-center gap-1.5 md:basis-auto"
      aria-hidden="true"
    >
      <Skeleton className="h-[var(--toolbar-control-h)] w-20 rounded-[var(--radius-pill)] xl:w-[var(--toolbar-control-h)]" />
      <Skeleton className="h-[var(--toolbar-control-h)] min-w-0 flex-1 rounded-lg md:w-64 md:flex-none" />
      <Skeleton className="h-[var(--toolbar-control-h)] w-20 rounded-[var(--radius-pill)] xl:w-[var(--toolbar-control-h)]" />
    </div>
  );
}
