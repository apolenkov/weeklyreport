import { RefreshCw } from "lucide-react";

interface AdminQueryIssueProps {
  readonly description: string;
  readonly onRetry: () => void;
}

export function AdminQueryIssue({
  description,
  onRetry,
}: AdminQueryIssueProps) {
  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-5"
      role="alert"
    >
      <div className="space-y-1">
        <h2 className="section-title">Could not load this tab</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Retry
      </button>
    </section>
  );
}
