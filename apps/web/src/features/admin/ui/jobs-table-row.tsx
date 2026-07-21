const MAX_ERROR_REASON_LENGTH = 80;

function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

// Structural (not the shared `FailedJob` alias): the tRPC client output the
// parent maps over and the zod-inferred alias disagree on `data` optionality
// and array readonly-ness, so the row accepts the readonly superset of both.
interface JobsTableRowJob {
  readonly id: string;
  readonly name: string;
  readonly failedReason: string;
  readonly stacktrace: readonly string[];
  readonly attemptsMade: number;
  readonly timestamp: number;
  readonly data?: unknown;
}

interface JobsTableRowProps {
  readonly job: JobsTableRowJob;
  readonly isExpanded: boolean;
  readonly isRetrying: boolean;
  readonly retryDisabled: boolean;
  readonly onToggleExpand: (jobId: string) => void;
  readonly onRetry: (jobId: string) => void;
}

export function JobsTableRow({
  job,
  isExpanded,
  isRetrying,
  retryDisabled,
  onToggleExpand,
  onRetry,
}: JobsTableRowProps) {
  const reason = job.failedReason || "—";
  const truncated = truncate(reason, MAX_ERROR_REASON_LENGTH);
  const canExpand = reason !== truncated;

  return (
    <tr
      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
      data-testid={`jobs-row-${job.id}`}
    >
      <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
        {job.id}
      </td>
      <td className="px-4 py-3 text-[var(--color-foreground)]">{job.name}</td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {job.attemptsMade}
      </td>
      <td className="px-4 py-3 text-[var(--color-foreground)]">
        <div
          className={
            isExpanded
              ? "whitespace-pre-wrap break-words text-xs"
              : "truncate text-xs"
          }
        >
          {isExpanded ? reason : truncated}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => onToggleExpand(job.id)}
            className="mt-1 text-[11px] font-semibold text-[var(--color-starbucks-accent)] hover:underline"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Collapse job ${job.id} error`
                : `Expand job ${job.id} error`
            }
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {formatTimestamp(job.timestamp)}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onRetry(job.id)}
          disabled={retryDisabled}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Retry job ${job.id}`}
        >
          {isRetrying ? "Retrying…" : "Retry"}
        </button>
      </td>
    </tr>
  );
}
