'use client';

import { useState } from 'react';

export function ExportPdfButton() {
  const [exporting, setExporting] = useState(false);

  function handleExport() {
    setExporting(true);
    // Simulate export delay
    setTimeout(() => {
      setExporting(false);
    }, 2000);
  }

  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Exporting...
        </>
      ) : (
        'Export PDF'
      )}
    </button>
  );
}
