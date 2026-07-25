import { STATUS_BADGE, type StatusBadgeStatus } from "./accordion-tokens";

// Gold rank marker in the dedicated left column — priorities-only hue
// (status-color-semantics). Sitting in its own column keeps the gutter from
// floating when an item is prioritized, and scales to several priorities.
/**
 * Rank Mark.
 * @param options - The options argument.
 */
export function RankMark({ rank }: { readonly rank: number }) {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold tabular-nums"
      style={{
        background: "var(--color-starbucks-gold)",
        color: "var(--color-primary-foreground)",
      }}
      title={`Priority ${rank}`}
    >
      {rank}
    </span>
  );
}

/**
 * Rail.
 * @param options - The options argument.
 */
export function Rail({ tone }: { readonly tone: string }) {
  return (
    <span
      className="min-h-[22px] self-stretch rounded-[2px]"
      style={{ background: tone }}
      aria-hidden="true"
    />
  );
}

// The fixed-width meta gutter: SDLC stage over the contributing lead's
// initials. An identity surface — it never encodes workflow status.
/**
 * Gutter.
 * @param options - The options argument.
 */
export function Gutter({
  stage,
  owner,
}: {
  readonly stage: string;
  readonly owner: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 pt-px">
      {stage ? (
        <span className="truncate text-[12.5px] font-semibold text-[var(--color-foreground)]">
          {stage}
        </span>
      ) : null}
      {owner ? (
        <span className="text-[11px] font-medium tabular-nums text-[var(--color-muted-foreground)]">
          {owner}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Status Badge.
 * @param options - The options argument.
 */
export function StatusBadge({
  status,
}: {
  readonly status: StatusBadgeStatus;
}) {
  const cfg = STATUS_BADGE[status];
  return (
    <span className="flex justify-end pt-px">
      <span
        className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: cfg.bg, color: cfg.fg }}
      >
        {cfg.label}
      </span>
    </span>
  );
}

/**
 * Section Header.
 * @param options - The options argument.
 */
export function SectionHeader({
  title,
  count,
}: {
  readonly title: string;
  readonly count: string;
}) {
  return (
    <div className="mb-3">
      <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-foreground)]">
        {title}
      </span>
      <span className="ml-2 text-[12px] font-medium tabular-nums text-[var(--color-muted-foreground)]">
        {count}
      </span>
    </div>
  );
}
