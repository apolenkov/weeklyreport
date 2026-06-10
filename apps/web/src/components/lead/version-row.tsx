import type { VersionSnapshot } from "./mock-data";

interface VersionRowProps {
  v: VersionSnapshot;
  isViewed: boolean;
  isLatestVersion: boolean;
  prevInOrder: VersionSnapshot | undefined;
  onRestore?: (version: number) => void;
  onTogglePin?: (version: number, pinned: boolean) => void;
}

function diffSummary(
  v: VersionSnapshot,
  prev: VersionSnapshot | undefined,
): { items: number; risks: number; decisions: number } | null {
  if (!prev) return null;
  const items = v.itemCount - prev.itemCount;
  const risks = v.riskCount - prev.riskCount;
  const decisions = v.decisionCount - prev.decisionCount;
  if (items === 0 && risks === 0 && decisions === 0) return null;
  return { items, risks, decisions };
}

function formatDiff(delta: number, label: string): string | null {
  if (delta === 0) return null;
  const sign = delta > 0 ? "+" : "−";
  const verb = delta > 0 ? "added" : "removed";
  return `${sign}${Math.abs(delta)} ${label} ${verb}`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill={filled ? "currentColor" : "none"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function VersionRow({
  v,
  isViewed,
  isLatestVersion,
  prevInOrder,
  onRestore,
  onTogglePin,
}: VersionRowProps) {
  const diff = diffSummary(v, prevInOrder);
  const diffParts = diff
    ? [
        formatDiff(diff.items, "items"),
        formatDiff(diff.risks, "risks"),
        formatDiff(diff.decisions, "decisions"),
      ].filter((s): s is string => s !== null)
    : [];

  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{
        background: isViewed
          ? "var(--color-success)"
          : "var(--color-background)",
        border: isViewed
          ? "1.5px solid var(--color-starbucks-accent)"
          : "1.5px solid transparent",
      }}
    >
      {onTogglePin && (
        <button
          type="button"
          className="flex-shrink-0 text-[var(--color-starbucks-accent)] transition-opacity hover:opacity-70"
          onClick={() => onTogglePin(v.version, !v.pinned)}
          aria-label={
            v.pinned ? `Unpin version ${v.version}` : `Pin version ${v.version}`
          }
          title={
            v.pinned
              ? "Unpin — allow retention cleanup"
              : "Pin — keep this version forever"
          }
        >
          <StarIcon filled={v.pinned} />
        </button>
      )}
      <div className="flex-1">
        <div className="text-sm font-semibold">
          Version {v.version}
          {isLatestVersion && (
            <span className="ml-2 text-[10px] font-medium text-[var(--color-starbucks-accent)]">
              Latest
            </span>
          )}
          {v.pinned && (
            <span className="ml-2 text-[10px] font-medium text-[var(--color-starbucks-accent)]">
              Pinned
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12px] text-[var(--color-muted-foreground)]">
          {v.timestamp} &middot; {v.itemCount} items &middot; {v.riskCount}{" "}
          risks &middot; {v.decisionCount} decisions
        </div>
        {diffParts.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
            {diffParts.map((part) => (
              <span
                key={part}
                className="font-medium"
                style={{
                  color: part.startsWith("+")
                    ? "var(--color-starbucks-accent)"
                    : "var(--color-destructive)",
                }}
              >
                {part}
              </span>
            ))}
          </div>
        )}
      </div>
      {!isLatestVersion && onRestore && (
        <button
          type="button"
          className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-3 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
          onClick={() => onRestore(v.version)}
        >
          Restore
        </button>
      )}
    </div>
  );
}
