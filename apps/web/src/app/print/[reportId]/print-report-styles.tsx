const PRINT_STYLES = `
            @media print {
              body { margin: 0; padding: 0; }
              body nav, body .no-print { display: none; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break-before { page-break-before: always; }
              .print-section-heading, .print-entity-header {
                break-after: avoid-page;
                page-break-after: avoid;
              }
              .print-entity-header {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              table { page-break-inside: avoid; }
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          `;

export function PrintReportStyles() {
  return <style>{PRINT_STYLES}</style>;
}
