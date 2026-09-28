import { useCallback } from "react";

interface LoadMoreRequestsButtonProps {
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
}

export function LoadMoreRequestsButton({
  isLoading,
  onLoadMore,
}: LoadMoreRequestsButtonProps) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        disabled={isLoading}
        onClick={onLoadMore}
        className="rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

interface ReopenNextPageIssueProps {
  readonly errorMessage: string;
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}

export function ReopenNextPageIssue({
  errorMessage,
  isRetrying,
  onRetry,
}: ReopenNextPageIssueProps) {
  const focusRetry = useCallback(
    (element: HTMLButtonElement | null) => element?.focus(),
    [],
  );

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] p-4 text-sm text-[var(--color-destructive)]"
    >
      <span>{errorMessage}</span>
      <button
        ref={focusRetry}
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
        className="rounded-[var(--radius-pill)] border border-current px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
