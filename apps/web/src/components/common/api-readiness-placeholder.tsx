interface ApiReadinessPlaceholderProps {
  readonly pageTitle: string;
  readonly roleLabel: string;
  readonly currentPath: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export function ApiReadinessPlaceholder({
  pageTitle,
  roleLabel,
  currentPath,
}: ApiReadinessPlaceholderProps) {
  return (
    <div className="space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Frontend stub
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Hello world</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          The approved mockups are ahead of the backend. The active Next.js UI
          is intentionally reduced to a simple shell while we complete the API
          contracts, lifecycle states, history, and publication flow.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Current route
          </p>
          <p className="mt-2 text-base font-medium">{pageTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{roleLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{currentPath}</p>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            API endpoints
          </p>
          <div className="mt-2 space-y-2 text-sm">
            <a
              className="block text-primary underline-offset-4 hover:underline"
              href={`${API_BASE_URL}/health/live`}
              rel="noreferrer"
              target="_blank"
            >
              {API_BASE_URL}/health/live
            </a>
            <a
              className="block text-primary underline-offset-4 hover:underline"
              href={`${API_BASE_URL}/health/ready`}
              rel="noreferrer"
              target="_blank"
            >
              {API_BASE_URL}/health/ready
            </a>
            <a
              className="block text-primary underline-offset-4 hover:underline"
              href={`${API_BASE_URL}/metrics`}
              rel="noreferrer"
              target="_blank"
            >
              {API_BASE_URL}/metrics
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
