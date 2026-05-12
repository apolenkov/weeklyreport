/**
 * UFB-058 / Phase 60 (stub route): Lead self-presentation surface.
 *
 * Lets the lead preview own report section as a polished slide before
 * submitting. Full implementation in Phase 60.
 */
export default function LeadSlidesPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <header>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Status Presentation
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Preview of your section as a polished slide.
            </p>
          </header>
          <div className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-8 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-amber-700"
                aria-label="Feature in development"
              >
                coming soon
              </span>
              <span className="text-sm font-semibold text-[var(--color-foreground)]">
                Slide preview is in development
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              You will see how your section looks in the published deck before
              you hit Submit — and a button to jump back to the editable form.
              Tracked in Phase 60 (Status Presentation).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
