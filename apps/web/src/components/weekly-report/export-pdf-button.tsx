'use client';

import { toast } from 'sonner';

/**
 * Phase 22 surface stub.
 *
 * The PDF export job is owned by Phase 23 (PDF & Jobs). For Phase 22 we keep
 * the button visually correct so the head sees the affordance, but clicking
 * it surfaces a toast.info indicating that the feature ships in v5.0
 * Phase 23 rather than silently doing nothing.
 *
 * TODO(Phase 23): wire pdfExport.request mutation.
 */
export function ExportPdfButton() {
  function handleExport() {
    toast.info('PDF export will be available in v5.0 Phase 23');
  }

  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={handleExport}
      title="PDF export ships in v5.0 Phase 23"
    >
      Export PDF
    </button>
  );
}
