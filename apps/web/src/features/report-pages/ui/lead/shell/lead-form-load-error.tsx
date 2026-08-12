import { AlertTriangle, RefreshCw } from "lucide-react";

interface LeadFormLoadErrorProps {
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}

export function LeadFormLoadError({
  isRetrying,
  onRetry,
}: LeadFormLoadErrorProps) {
  return (
    <section
      role="alert"
      aria-labelledby="lead-form-load-error-title"
      aria-busy={isRetrying}
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center"
    >
      <AlertTriangle
        aria-hidden="true"
        className="h-6 w-6 text-[var(--color-warning)]"
      />
      <div>
        <h1
          id="lead-form-load-error-title"
          className="font-semibold text-[var(--color-foreground)]"
        >
          Report form could not be loaded
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          A temporary problem prevented loading this report form. Try again to
          continue.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Retry
      </button>
      {isRetrying && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Retrying…
        </p>
      )}
    </section>
  );
}
