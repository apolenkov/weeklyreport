"use client";

function StageChips({ stageTags }: { readonly stageTags: readonly string[] }) {
  if (stageTags.length === 0) return null;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      title={stageTags.join(", ")}
    >
      {stageTags.map((stage) => (
        <span
          key={stage}
          className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]"
        >
          {stage}
        </span>
      ))}
    </span>
  );
}

interface MetaRowProps {
  readonly authorName: string | null | undefined;
  readonly stageTags: readonly string[];
  readonly ariaLabel?: string;
  readonly className?: string;
  // Mark foreign rows read-only after the author name.
  readonly foreign?: boolean;
}

function AuthorMeta({
  authorName,
  foreign,
}: {
  readonly authorName: string | null | undefined;
  readonly foreign: boolean;
}) {
  const showReadOnly = foreign && Boolean(authorName);
  return (
    <span className="truncate text-[11px] font-medium text-[var(--color-muted-foreground)]">
      {authorName ?? ""}
      {showReadOnly && (
        <span
          role="img"
          aria-label="Read-only — authored by another lead"
          title="Read-only — authored by another lead"
        >
          {" 🔒"}
        </span>
      )}
    </span>
  );
}

export function MetaRow({
  authorName,
  stageTags,
  ariaLabel,
  className = "mt-3",
  foreign = false,
}: MetaRowProps) {
  return (
    <div
      className={`${className} flex items-center justify-between gap-2`}
      role="group"
      aria-label={ariaLabel}
    >
      <AuthorMeta authorName={authorName} foreign={foreign} />
      <StageChips stageTags={stageTags} />
    </div>
  );
}
