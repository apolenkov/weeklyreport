'use client';

type ToggleAllButtonProps = {
  readonly onToggle: () => void;
};

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
    >
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

export function ToggleAllButton({ onToggle }: ToggleAllButtonProps) {
  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
      onClick={onToggle}
      title="Toggle All"
    >
      <CollapseIcon />
      Toggle All
    </button>
  );
}
