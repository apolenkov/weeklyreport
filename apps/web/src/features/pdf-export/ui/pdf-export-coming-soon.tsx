import { ComingSoonIconButton } from "@customreport/ui/components/coming-soon-control";
import { FileDown } from "lucide-react";

// Lead is role-gated off pdfExport.request; ComingSoonIconButton is the
// deferred-feature trace (do not wire this control).
export function PdfExportComingSoonControl() {
  return (
    <ComingSoonIconButton
      icon={FileDown}
      shape="toolbar"
      ariaLabel="PDF export is coming soon"
      testId="lead-pdf-export-coming-soon"
    />
  );
}
