const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function PrintReportPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Frontend stub
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Hello world</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Printable report UI is intentionally disabled while the API-first
            contracts and archive/publication pipeline are being completed.
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
          </div>
        </div>
      </div>
    </main>
  );
}
