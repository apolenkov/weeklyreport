import { ComingSoonIconButton } from "@customreport/ui/components/coming-soon-control";
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
    <ComingSoonIconButton
      icon={FileDown}
      shape="toolbar"
      ariaLabel="PDF export is coming soon"
      testId="lead-pdf-export-coming-soon"
    />
  );
}
