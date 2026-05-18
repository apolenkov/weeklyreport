"use client";

type MetaRowProps = {
  readonly authorName: string | null | undefined;
  readonly stageTags: readonly string[];
  readonly ariaLabel?: string;
  readonly className?: string;
};

export function MetaRow({
  authorName,
  stageTags,
  ariaLabel,
  className = "mt-3",
}: MetaRowProps) {
  const title =
    stageTags.length === 0 ? "All stages" : stageTags.join(", ");

  return (
    <div
      className={`${className} flex items-center justify-between gap-2`}
      aria-label={ariaLabel}
    >
      <span className="truncate text-[11px] font-medium text-[var(--color-muted-foreground)]">
        {authorName ?? ""}
      </span>
      <span
        className="inline-flex flex-wrap items-center gap-1"
        title={title}
      >
        {stageTags.length === 0 ? (
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-muted-foreground)]">
            All stages
          </span>
        ) : (
          stageTags.map((stage) => (
            <span
              key={stage}
              className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]"
            >
              {stage}
            </span>
          ))
        )}
      </span>
    </div>
  );
}
