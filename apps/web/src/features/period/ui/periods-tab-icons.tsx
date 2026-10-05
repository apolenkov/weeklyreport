export {
  DeleteIcon,
  EditIcon,
  PlusIcon,
} from "../../../shared/ui/icons/action-icons";
export { RotatingChevron as Chevron } from "../../../shared/ui/report-shell/rotating-chevron";

const DANGER_ICON_CLASSES =
  "text-[var(--color-destructive-emphasis)] hover:text-[var(--color-destructive-emphasis-hover)]";
const NEUTRAL_ICON_CLASSES =
  "text-[var(--color-foreground)] hover:text-[var(--color-starbucks-accent)]";

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
      className={`btn-press inline-flex h-8 w-8 pointer-coarse:h-[var(--touch-target-min)] pointer-coarse:w-[var(--touch-target-min)] items-center justify-center rounded-full border border-transparent transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : `hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] ${
              tone === "danger" ? DANGER_ICON_CLASSES : NEUTRAL_ICON_CLASSES
            }`
      }`}
    >
      {icon}
    </button>
  );
}

export function PublishIcon() {
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
