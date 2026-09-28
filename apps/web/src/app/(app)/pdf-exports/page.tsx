import { PdfRecoverySection } from "../../../features/pdf-export";

export default function PdfExportsPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PdfRecoverySection />
      </div>
    </main>
  );
}
