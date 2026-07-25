"use client";

// Empty stageTags: "all-stages" = implicit full scope for items/decisions;
// "no-stage-warning" = stage-less risk is an anomaly (at-risk tokens).
const EMPTY_STAGE_CHIPS = {
  "all-stages": {
    label: "All stages",
    className: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  },
  "no-stage-warning": {
    label: "No stage set",
    className:
      "bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]",
  },
} as const;

/** "none" renders no chip at all — an activity-parented row is legitimately
 * stage-less, so neither the warning nor an "All stages" chip applies. */
type EmptyStageChip = keyof typeof EMPTY_STAGE_CHIPS | "none";

interface MetaRowProps {
  readonly authorName: string | null | undefined;
  readonly stageTags: readonly string[];
  readonly ariaLabel?: string;
  readonly className?: string;
  /** When true, render a 🔒 after authorName to signal a foreign (read-only) row. */
  readonly foreign?: boolean;
  /** Chip rendered when `stageTags` is empty. Defaults to "All stages". */
  readonly emptyStageChip?: EmptyStageChip;
}

export function MetaRow({
  authorName,
  stageTags,
  ariaLabel,
  className = "mt-3",
  foreign = false,
  emptyStageChip = "all-stages",
}: MetaRowProps) {
  const emptyChip =
    emptyStageChip === "none" ? null : EMPTY_STAGE_CHIPS[emptyStageChip];
  const title =
    stageTags.length === 0 ? (emptyChip?.label ?? "") : stageTags.join(", ");

  return (
    <div
      className={`${className} flex items-center justify-between gap-2`}
      role="group"
      aria-label={ariaLabel}
    >
      <span className="truncate text-[11px] font-medium text-[var(--color-muted-foreground)]">
        {authorName ?? ""}
        {foreign && authorName ? (
          <span
            role="img"
            aria-label="Read-only — authored by another lead"
            title="Read-only — authored by another lead"
          >
            {" 🔒"}
          </span>
        ) : null}
      </span>
      <span className="inline-flex flex-wrap items-center gap-1" title={title}>
        {stageTags.length === 0
          ? emptyChip && (
              <span
                className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold ${emptyChip.className}`}
              >
                {emptyChip.label}
              </span>
            )
          : stageTags.map((stage) => (
              <span
                key={stage}
                className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]"
              >
                {stage}
              </span>
            ))}
      </span>
    </div>
  );
}
