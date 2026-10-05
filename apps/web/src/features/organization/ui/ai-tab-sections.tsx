import { TabsList, TabsTrigger } from "@customreport/ui/components/ui/tabs";

export function ReadinessSummary({
  readiness,
}: Readonly<{ readiness: Readonly<{ provider: string; features: string }> }>) {
  return (
    <p
      role="status"
      aria-label="AI readiness"
      className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"
    >
      <span>
        <span className="text-[var(--color-muted-foreground)]">Provider </span>
        <strong className="font-semibold text-[var(--color-foreground)]">
          {readiness.provider}
        </strong>
      </span>
      <span>
        <span className="text-[var(--color-muted-foreground)]">Features </span>
        <strong className="font-semibold text-[var(--color-foreground)]">
          {readiness.features}
        </strong>
      </span>
    </p>
  );
}

export function RetryAlert({
  message,
  isFetching,
  onRetry,
}: Readonly<{ message: string; isFetching: boolean; onRetry: () => void }>) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-sm text-[var(--color-destructive)]">{message}</p>
      <button
        type="button"
        className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
        onClick={onRetry}
        disabled={isFetching}
      >
        {isFetching ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

export function AiTabsList() {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <TabsList
        variant="line"
        className="grid w-full grid-cols-2 justify-start border-b border-[var(--color-border)] group-data-[orientation=horizontal]/tabs:h-auto sm:inline-flex sm:w-fit sm:min-w-max"
      >
        <TabsTrigger value="provider">Provider</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
      </TabsList>
    </div>
  );
}
