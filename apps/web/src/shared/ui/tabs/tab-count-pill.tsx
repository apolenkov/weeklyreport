interface TabCountPillProps {
  readonly ariaLabel: string;
  readonly count: number;
  readonly testId?: string;
  readonly unavailable?: boolean;
}

const MAX_BADGE_COUNT = 99;

function formatTabCount(count: number): string {
  if (count > MAX_BADGE_COUNT) return `${MAX_BADGE_COUNT}+`;
  return String(count);
}

export function TabCountPill({
  ariaLabel,
  count,
  testId,
  unavailable = false,
}: TabCountPillProps) {
  const safeCount = Math.max(0, count);
  const visible = unavailable || safeCount > 0;
  if (!visible) return null;

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-xs font-bold leading-none tracking-normal text-[var(--color-destructive-foreground)] tabular-nums shadow-[0_1px_2px_var(--color-border-strong)] ring-1 ring-[var(--color-card)]"
        data-testid={testId}
      >
        {unavailable ? "!" : formatTabCount(safeCount)}
      </span>
      <span className="sr-only">{ariaLabel}</span>
    </>
  );
}
