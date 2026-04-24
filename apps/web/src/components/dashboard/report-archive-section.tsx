'use client';

import { useState } from 'react';

import type { ArchiveReport } from './mock-data';

type ReportArchiveSectionProps = {
  readonly reports: ArchiveReport[];
  readonly totalCount?: number;
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  active: {
    bg: 'var(--color-success)',
    text: 'var(--color-primary)',
    label: 'Active',
  },
  published: {
    bg: 'var(--color-primary)',
    text: '#fff',
    label: 'Published',
  },
  draft: {
    bg: '#fef3c7',
    text: '#8a6d1b',
    label: 'Draft',
  },
};

const ITEMS_PER_PAGE = 4;

export function ReportArchiveSection({ reports, totalCount = 12 }: ReportArchiveSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // In real app, pages would fetch from API. Using mock data for page 1.
  const visibleReports = reports.slice(0, ITEMS_PER_PAGE);

  return (
    <div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-sans)] text-xl font-semibold text-[var(--color-foreground)]">
          Report Archive
        </h2>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {totalCount} reports total
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleReports.map((report) => {
          const config = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.draft!;
          const isActive = report.status === 'active';

          return (
            <a
              key={report.id}
              href={isActive ? '/head/report' : `/reports/${report.id}`}
              className="group rounded-[var(--radius)] border bg-[var(--color-card)] p-4 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)] transition-[border-color] duration-150 hover:border-[var(--color-starbucks-accent)]"
              style={{
                borderLeft: `3px solid ${isActive ? 'var(--color-starbucks-accent)' : 'var(--color-border)'}`,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">{report.weekLabel}</span>
                <span
                  className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: config.bg, color: config.text }}
                >
                  {config.label}
                </span>
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {report.dateRange} &middot; {report.submissionLabel}
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                {report.productCount} products
                {report.riskCount > 0 && ` \u00b7 ${report.riskCount} risks`}
                {report.decisionCount > 0 && ` \u00b7 ${report.decisionCount} decisions`}
              </div>
            </a>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent font-[family-name:var(--font-sans)] text-[13px] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-35"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          &lsaquo;
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            type="button"
            className="flex h-9 min-w-[36px] items-center justify-center rounded-lg font-[family-name:var(--font-sans)] text-[13px] transition-colors"
            style={
              page === currentPage
                ? {
                    background: 'var(--color-starbucks-accent)',
                    color: '#fff',
                    border: 'none',
                  }
                : {
                    background: 'transparent',
                    color: 'inherit',
                    border: '1px solid var(--color-border)',
                  }
            }
            onClick={() => setCurrentPage(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent font-[family-name:var(--font-sans)] text-[13px] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-35"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          &rsaquo;
        </button>
      </div>
    </div>
  );
}
