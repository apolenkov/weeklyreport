interface TabCountPillProps {
  readonly ariaLabel: string;
  readonly count: number;
  readonly testId?: string;
}

const MAX_BADGE_COUNT = 99;

function formatTabCount(count: number): string {
  if (count > MAX_BADGE_COUNT) return `${MAX_BADGE_COUNT}+`;
  return String(count);
}

export function TabCountPill({ ariaLabel, count, testId }: TabCountPillProps) {
  const safeCount = Math.max(0, count);
  const visible = safeCount > 0;
  if (!visible) return null;

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-[10px] font-bold leading-none tracking-normal text-white tabular-nums shadow-[0_1px_2px_rgba(0,0,0,0.16)] ring-1 ring-[var(--color-card)]"
        data-testid={testId}
      >
        {formatTabCount(safeCount)}
      </span>
      <span className="sr-only">{ariaLabel}</span>
    </>
  );
}
