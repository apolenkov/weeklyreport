import { PdfRecoverySection } from "../../../features/pdf-export";

export default function PdfExportsPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            PDF exports
          </h1>
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <PdfRecoverySection />
          </div>
        </div>
      </div>
    </main>
  );
}
