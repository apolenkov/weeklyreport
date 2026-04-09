import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { SubmissionDashboardRow } from '@customreport/shared';

import { SubmissionDashboard } from './submission-dashboard';

void React;

afterEach(() => {
  cleanup();
});

const rows: SubmissionDashboardRow[] = [
  {
    leadId: '00000000-0000-4000-8000-000000000012',
    leadName: 'Lead 2',
    role: 'lead',
    projectNames: ['Project 2'],
    status: 'submitted',
    submittedAt: new Date('2026-04-09T10:00:00.000Z'),
  },
  {
    leadId: '00000000-0000-4000-8000-000000000013',
    leadName: 'Lead 3',
    role: 'lead',
    projectNames: ['Project 3'],
    status: 'draft',
    submittedAt: null,
  },
  {
    leadId: '00000000-0000-4000-8000-000000000011',
    leadName: 'Lead 1',
    role: 'lead',
    projectNames: ['Project 1'],
    status: 'draft',
    submittedAt: null,
  },
];

describe('SubmissionDashboard', () => {
  it('renders lead names, project names, and clear draft/submitted labels', () => {
    render(<SubmissionDashboard rows={rows} />);

    expect(screen.getByRole('table', { name: 'Submission dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Lead 1')).toBeInTheDocument();
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getAllByText('draft')).toHaveLength(2);
    expect(screen.getByText('submitted')).toBeInTheDocument();
  });

  it('renders outstanding draft rows before submitted rows', () => {
    render(<SubmissionDashboard rows={rows} />);

    const table = screen.getByRole('table', { name: 'Submission dashboard' });
    const bodyRows = within(table).getAllByRole('row').slice(1);

    expect(bodyRows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Lead 1',
      'Lead 3',
      'Lead 2',
    ]);
  });
});
