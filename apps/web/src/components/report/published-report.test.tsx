import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AssembledReport, PdfExportJob } from '@customreport/shared';

import { PublishedReport } from './published-report';

void React;

afterEach(() => {
  cleanup();
});

const publishedReport: AssembledReport = {
  reportId: '22222222-2222-4222-8222-222222222222',
  periodStart: new Date('2026-04-06T00:00:00.000Z'),
  periodEnd: new Date('2026-04-12T23:59:59.000Z'),
  deadline: new Date('2026-04-10T15:00:00.000Z'),
  status: 'published',
  publishedAt: new Date('2026-04-09T14:00:00.000Z'),
  publishedById: '00000000-0000-4000-8000-000000000001',
  publishedByName: 'Department Head',
  portfolioOverview: {
    status: 'yellow',
    totals: {
      green: 1,
      yellow: 2,
      red: 0,
    },
  },
  sections: [
    {
      reportSectionId: '11111111-1111-4111-8111-111111111111',
      reportId: '22222222-2222-4222-8222-222222222222',
      authorId: '33333333-3333-4333-8333-333333333333',
      authorName: 'Lead 1',
      status: 'submitted',
      submittedAt: new Date('2026-04-09T10:00:00.000Z'),
      projects: [
        {
          projectId: '44444444-4444-4444-8444-444444444444',
          projectName: 'Project 1',
          trafficLight: 'yellow',
        },
      ],
      items: [
        {
          projectId: '44444444-4444-4444-8444-444444444444',
          type: 'current',
          text: 'Current update',
          tag: 'feature',
          workflowStatus: 'in_progress',
          carriedOver: false,
        },
      ],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: 'Priority 1' },
        { rank: 2, text: 'Priority 2' },
        { rank: 3, text: 'Priority 3' },
      ],
    },
  ],
};

describe('PublishedReport', () => {
  it('renders the published report in read-only form', () => {
    render(<PublishedReport report={publishedReport} />);

    expect(screen.getByRole('heading', { name: 'Published Report' })).toBeInTheDocument();
    // publishedByName is shown with a User icon — just "Department Head", not "Published by Department Head"
    expect(screen.getByText('Department Head')).toBeInTheDocument();
    // Portfolio uses TrafficLightBadge with label "Overall: yellow"
    expect(screen.getByText('Overall: yellow')).toBeInTheDocument();
    expect(screen.getByText('Current update')).toBeInTheDocument();
  });

  it('does not expose edit or publish controls to viewers', () => {
    render(<PublishedReport report={publishedReport} />);

    expect(screen.queryByRole('button', { name: 'Publish Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders async export progress and result state for published reports', () => {
    const exportJob: PdfExportJob = {
      jobId: '99999999-9999-4999-8999-999999999999',
      reportId: publishedReport.reportId,
      status: 'completed',
      requestedAt: new Date('2026-04-09T15:00:00.000Z'),
      completedAt: new Date('2026-04-09T15:00:02.000Z'),
      checksum: 'phase-2-demo-checksum',
      templateVersion: 'phase-2-pdf-v1',
      artifactUrl: '/exports/report.pdf',
    };

    render(<PublishedReport exportJob={exportJob} onRequestPdfExport={() => {}} report={publishedReport} />);

    // When export is completed, shows a download link (Button asChild wrapping <a>)
    expect(screen.getByRole('link', { name: /Download PDF/i })).toHaveAttribute(
      'href',
      '/exports/report.pdf',
    );
    // Export status badge shows just the status text
    expect(screen.getByText('completed')).toBeInTheDocument();
  });
});
