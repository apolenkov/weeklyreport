"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

function TableSkeleton() {
  return (
    <div
      aria-label="Loading data"
      className="h-64 w-full animate-pulse motion-reduce:animate-none rounded-md bg-muted/50"
      role="status"
    />
  );
}

function TrendsQueryIssue({
  isRetrying,
  onRetry,
}: {
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <div
      aria-busy={isRetrying}
      className="flex min-h-32 flex-col items-start justify-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6"
      role="alert"
    >
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Could not load this trend.
      </p>
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
        disabled={isRetrying}
        onClick={onRetry}
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

interface TrendsSectionProps {
  readonly children: ReactNode;
  readonly emptyMessage?: string | undefined;
  readonly headingId: string;
  readonly isError: boolean;
  readonly isLoading: boolean;
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
  readonly title: string;
}

function TrendsSectionContent({
  children,
  emptyMessage,
  isError,
  isLoading,
  isRetrying,
  onRetry,
}: TrendsSectionProps) {
  if (isLoading) return <TableSkeleton />;
  if (isError)
    return <TrendsQueryIssue isRetrying={isRetrying} onRetry={onRetry} />;
  if (emptyMessage !== undefined)
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  return <div className="contents">{children}</div>;
}

export function TrendsSection(props: TrendsSectionProps) {
  const { headingId, title } = props;

  return (
    <section aria-labelledby={headingId} className="card-surface p-4 sm:p-6">
      <h2 id={headingId} className="mb-3 text-lg font-medium">
        {title}
      </h2>
      <TrendsSectionContent {...props} />
    </section>
  );
}
