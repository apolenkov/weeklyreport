const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Frontend stub
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Hello world</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            The frontend is intentionally reduced while we finish the API from
            the approved mockups. Use the API links below to verify the active
            backend surface.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            API endpoints
          </p>
          <div className="mt-2 space-y-2 text-sm">
            <a className="block text-primary underline-offset-4 hover:underline" href={`${API_BASE_URL}/health/live`} rel="noreferrer" target="_blank">
              {API_BASE_URL}/health/live
            </a>
            <a className="block text-primary underline-offset-4 hover:underline" href={`${API_BASE_URL}/health/ready`} rel="noreferrer" target="_blank">
              {API_BASE_URL}/health/ready
            </a>
            <a className="block text-primary underline-offset-4 hover:underline" href={`${API_BASE_URL}/metrics`} rel="noreferrer" target="_blank">
              {API_BASE_URL}/metrics
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
