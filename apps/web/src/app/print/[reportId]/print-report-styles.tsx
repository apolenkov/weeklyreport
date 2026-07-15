export function PrintReportStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger -- static, hardcoded print CSS with no user input
      dangerouslySetInnerHTML={{
        __html: `
            @media print {
              body { margin: 0; padding: 0; }
              body nav, body .no-print { display: none; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break-before { page-break-before: always; }
              section { page-break-inside: avoid; }
              table { page-break-inside: avoid; }
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          `,
      }}
    />
  );
}
