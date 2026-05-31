"use client";

type MetaRowProps = {
  readonly authorName: string | null | undefined;
  readonly stageTags: readonly string[];
  readonly ariaLabel?: string;
  readonly className?: string;
  /** When true, render a 🔒 after authorName to signal a foreign (read-only) row. */
  readonly foreign?: boolean;
};

export function MetaRow({
  authorName,
  stageTags,
  ariaLabel,
  className = "mt-3",
  foreign = false,
}: MetaRowProps) {
  const title = stageTags.length === 0 ? "All stages" : stageTags.join(", ");

  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset is a form element; group on a div is correct for a non-form metadata row
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
