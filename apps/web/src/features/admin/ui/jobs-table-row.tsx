import type { FailedJob } from "@weeklyreport/shared";

import { formatDateTime } from "../../../shared/lib/format/format-date";
import { truncate } from "../model/action-log-format";

const MAX_ERROR_REASON_LENGTH = 80;

// The guard stays here: a queued-but-unstamped job carries 0, which
// `formatDateTime` would render as the epoch rather than as "no timestamp".
function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return formatDateTime(new Date(ms));
}

interface JobsTableRowProps {
  readonly job: FailedJob;
  readonly isExpanded: boolean;
  readonly isRetrying: boolean;
  readonly retryDisabled: boolean;
  readonly isRemoving: boolean;
  readonly removeDisabled: boolean;
  readonly onToggleExpand: (jobId: string) => void;
  readonly onRetry: (jobId: string) => void;
  readonly onRemove: (jobId: string) => void;
}

// Long failure reasons collapse to one truncated line; the toggle appears only
// when truncation actually dropped something.
function JobErrorCell({
  jobId,
  failedReason,
  isExpanded,
  onToggleExpand,
}: {
  readonly jobId: string;
  readonly failedReason: string;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (jobId: string) => void;
}) {
  const reason = failedReason;
  const truncated = truncate(reason, MAX_ERROR_REASON_LENGTH);
  const canExpand = reason !== truncated;

  return (
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
          onClick={() => onToggleExpand(jobId)}
          className="mt-1 text-xs font-semibold text-[var(--color-starbucks-accent)] hover:underline"
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `Collapse job ${jobId} error`
              : `Expand job ${jobId} error`
          }
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      )}
    </td>
  );
}

export function JobsTableRow({
  job,
  isExpanded,
  isRetrying,
  retryDisabled,
  isRemoving,
  removeDisabled,
  onToggleExpand,
  onRetry,
  onRemove,
}: JobsTableRowProps) {
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
      <JobErrorCell
        jobId={job.id}
        failedReason={job.failedReason}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
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
        <button
          type="button"
          onClick={() => onRemove(job.id)}
          disabled={removeDisabled}
          className="ml-2 btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-destructive)] px-3 py-1.5 text-xs font-semibold text-[var(--color-destructive)] disabled:opacity-50"
          aria-label={`Remove failed job ${job.id}`}
        >
          {isRemoving ? "Removing…" : "Remove"}
        </button>
      </td>
    </tr>
  );
}
