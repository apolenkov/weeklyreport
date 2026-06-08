/**
 * UFB-067 icon set + shared IconButton shell for the Periods tab, extracted
 * from `periods-tab.tsx` (R3a-4 max-lines split). Each icon is a 16×16
 * stroke-currentColor SVG; IconButton centralises the 32×32 sizing, hover
 * state, and a11y labelling so `ActionIconRow` stays declarative.
 */

/**
 * UFB-067: shared icon-button shell. Centralises the 32×32 sizing, hover
 * state, and a11y labelling so the individual `ActionIconRow` icons stay
 * declarative.
 */
export function IconButton({
  testId,
  label,
  onClick,
  icon,
  tone,
  disabled,
}: {
  readonly testId: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly tone?: "danger";
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`btn-press inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : `hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] ${
              tone === "danger"
                ? "text-[#991b1b] hover:text-[#7f1d1d]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-starbucks-accent)]"
            }`
      }`}
    >
      {icon}
    </button>
  );
}

export function Chevron({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// UFB-067: per-action icons used by the inline ActionIconRow. Each icon
// is a 16×16 stroke-currentColor SVG that the IconButton shell paints in
// the appropriate tone (muted by default, danger red for Archive). Paths
// follow the same lucide-style stroke conventions used elsewhere in the
// admin tabs so the visual language stays consistent.

export function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function PublishIcon() {
  // Paper-airplane / "send" silhouette.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function ReopenIcon() {
  // Rotate-counter-clockwise / refresh arrow.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function ArchiveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export function UnarchiveIcon() {
  // Archive-restore: archive box with an upward arrow on top.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <polyline points="9 14 12 11 15 14" />
      <line x1="12" y1="11" x2="12" y2="18" />
    </svg>
  );
}

export function DeleteIcon() {
  // Trash icon for period deletion.
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
