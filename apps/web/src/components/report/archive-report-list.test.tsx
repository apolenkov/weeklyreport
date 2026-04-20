import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ArchiveReportSummary } from '@customreport/shared';

import { ArchiveReportList } from './archive-report-list';

void React;

afterEach(() => {
  cleanup();
});

const reports: ArchiveReportSummary[] = [
  {
    reportId: '22222222-2222-4222-8222-222222222222',
    periodStart: new Date('2026-04-06T00:00:00.000Z'),
    periodEnd: new Date('2026-04-12T23:59:59.000Z'),
    publishedAt: new Date('2026-04-09T14:00:00.000Z'),
    publishedByName: 'Department Head',
    portfolioStatus: 'yellow',
  },
  {
    reportId: '11111111-1111-4111-8111-111111111111',
    periodStart: new Date('2026-03-30T00:00:00.000Z'),
    periodEnd: new Date('2026-04-05T23:59:59.000Z'),
    publishedAt: new Date('2026-04-05T14:00:00.000Z'),
    publishedByName: 'Department Head',
    portfolioStatus: 'green',
  },
];

describe('ArchiveReportList', () => {
  it('renders report cards as links with correct hrefs', () => {
    render(<ArchiveReportList reports={reports} />);

    // Component renders report links (no heading element in this component)
    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/reports/22222222-2222-4222-8222-222222222222');
    expect(links[1]).toHaveAttribute('href', '/reports/11111111-1111-4111-8111-111111111111');
  });

  it('shows published-by names in report cards', () => {
    render(<ArchiveReportList reports={reports} />);

    // Each report card shows "by Department Head"
    const byLabels = screen.getAllByText(/by Department Head/);
    expect(byLabels).toHaveLength(2);
  });

  it('renders empty state when there are no reports', () => {
    render(<ArchiveReportList reports={[]} />);

    expect(screen.getByText('Опубликованных отчётов нет')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
