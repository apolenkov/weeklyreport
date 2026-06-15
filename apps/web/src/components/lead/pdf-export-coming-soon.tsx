import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { FileDown } from "lucide-react";

/**
 * Inert toolbar control marking lead PDF export as deferred
 * (deferred-feature-pattern; reference: `VersionComingSoonControl` in
 * `./version-coming-soon.tsx`). Lead is FORBIDDEN from the real
 * `pdfExport.request` path, so this control is never wired to a backend
 * call — it only shows the coming-soon tooltip.
 */
export function PdfExportComingSoonControl() {
  // TODO(lead-pdf-export): there is no planned lead export path — lead is
  // excluded from pdfExport (role-coverage-gate). This control stays inert;
  // do NOT wire it to pdfExport.request.
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-label="PDF export is coming soon"
        title="Coming Soon"
        data-testid="lead-pdf-export-coming-soon"
        className="inline-flex h-8 w-8 shrink-0 cursor-default items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-empty)] text-[12px] font-semibold text-[var(--color-muted-foreground)]"
      >
        <FileDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <ComingSoonBadge
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}
