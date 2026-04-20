import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';

import {
  reportSectionReadModelSchema,
  type AssembledReport,
  type DraftSavePayload,
} from '@customreport/shared';

import { AssembledReportReview } from './assembled-report-review';

void React;

afterEach(() => {
  cleanup();
});

const assembledReport: AssembledReport = {
  reportId: '22222222-2222-4222-8222-222222222222',
  periodStart: new Date('2026-04-06T00:00:00.000Z'),
  periodEnd: new Date('2026-04-12T23:59:59.000Z'),
  deadline: new Date('2026-04-10T15:00:00.000Z'),
  status: 'draft',
  publishedAt: null,
  publishedById: null,
  publishedByName: null,
  portfolioOverview: {
    status: 'red',
    totals: {
      green: 1,
      yellow: 1,
      red: 1,
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
          trafficLight: 'green',
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

function buildUpdatedReport(input: DraftSavePayload): AssembledReport {
  return {
    ...assembledReport,
    sections: assembledReport.sections.map((section) =>
      section.reportSectionId === input.reportSectionId
        ? reportSectionReadModelSchema.parse({
            ...section,
            projects: section.projects.map((project) => ({
              ...project,
              trafficLight:
                input.projectStatuses.find((status) => status.projectId === project.projectId)
                  ?.status ?? null,
            })),
            items: input.items.map((item) => ({
              ...item,
              carriedOver: item.carriedOver ?? false,
            })),
            risks: input.risks,
            decisions: input.decisions,
            priorities: input.priorities,
          })
        : section,
    ),
  };
}

describe('AssembledReportReview', () => {
  it('renders the portfolio overview and assembled section content', () => {
    render(
      <AssembledReportReview
        initialReport={assembledReport}
        onPublish={async () => assembledReport}
        onUpdateSection={async () => assembledReport}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Assembled Report' })).toBeInTheDocument();
    // Portfolio status is shown as a Badge with just the status text
    expect(screen.getByText('red')).toBeInTheDocument();
    expect(screen.getByText('Lead 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Current update')).toBeInTheDocument();
  });

  it('allows head review edits before publish', async () => {
    const user = userEvent.setup();
    const onUpdateSection = vi.fn(async (input: DraftSavePayload) => buildUpdatedReport(input));

    render(
      <AssembledReportReview
        initialReport={assembledReport}
        onPublish={async () => assembledReport}
        onUpdateSection={onUpdateSection}
      />,
    );

    // Traffic light is a radiogroup — click the "Yellow" radio button
    const radioGroup = screen.getByRole('radiogroup', {
      name: 'Lead 1 / Project 1 traffic light',
    });
    const yellowButton = radioGroup.querySelector('[aria-label="Yellow"]') as HTMLElement;
    await user.click(yellowButton);

    await waitFor(() => {
      expect(onUpdateSection).toHaveBeenCalled();
      // After update the Yellow button should be checked
      const updatedRadioGroup = screen.getByRole('radiogroup', {
        name: 'Lead 1 / Project 1 traffic light',
      });
      const updatedYellow = updatedRadioGroup.querySelector('[aria-label="Yellow"]');
      expect(updatedYellow).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('locks the review surface after publish', async () => {
    const user = userEvent.setup();
    const publishedReport: AssembledReport = {
      ...assembledReport,
      status: 'published',
      publishedAt: new Date('2026-04-09T14:00:00.000Z'),
      publishedById: '00000000-0000-4000-8000-000000000001',
      publishedByName: 'Department Head',
    };

    render(
      <AssembledReportReview
        initialReport={assembledReport}
        onPublish={async () => publishedReport}
        onUpdateSection={async () => assembledReport}
      />,
    );

    // Button says "Publish Report" (capital R)
    await user.click(screen.getByRole('button', { name: 'Publish Report' }));

    // ConfirmDialog appears — click the "Publish" confirm button
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      // toast.success fires in Sonner portal (outside JSDOM) — assert on the mock
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('published'), expect.anything());
      expect(screen.queryByRole('button', { name: 'Publish Report' })).not.toBeInTheDocument();
      // After publish all radio buttons in the radiogroup should be disabled
      const radioGroup = screen.getByRole('radiogroup', {
        name: 'Lead 1 / Project 1 traffic light',
      });
      const buttons = radioGroup.querySelectorAll('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
