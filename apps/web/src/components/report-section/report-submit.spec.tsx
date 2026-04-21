import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { reportSectionReadModelSchema } from '@customreport/shared';

import { createDemoSection } from '../../test/fixtures';
import { ReportSectionForm } from './report-section-form';

void React;

afterEach(() => {
  cleanup();
});

describe('ReportSectionForm submit flow', () => {
  it('opens a confirmation dialog with the exact copy', async () => {
    const user = userEvent.setup();
    render(
      <ReportSectionForm
        initialSection={createDemoSection()}
        onSaveDraft={async () => createDemoSection()}
        onSubmit={async () =>
          reportSectionReadModelSchema.parse({
            ...createDemoSection(),
            status: 'submitted',
            submittedAt: new Date(),
          })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Submit Section' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Submit Section');
  });

  it('renders validation errors when D-03 conditions are missing', async () => {
    const user = userEvent.setup();

    render(
      <ReportSectionForm
        initialSection={{
          ...createDemoSection(),
          items: [],
          priorities: [
            { rank: 1, text: '' },
            { rank: 2, text: '' },
            { rank: 3, text: '' },
          ],
        }}
        onSaveDraft={async () => createDemoSection()}
        onSubmit={async () =>
          reportSectionReadModelSchema.parse({
            ...createDemoSection(),
            status: 'submitted',
            submittedAt: new Date(),
          })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Submit Section' }));
    await user.click(await screen.findByRole('button', { name: 'Submit Section' }));

    expect(screen.getByText(/must have a traffic light status/i)).toBeInTheDocument();
    expect(screen.getByText(/needs at least one Current Week item/i)).toBeInTheDocument();
    expect(screen.getByText(/priorities must be filled/i)).toBeInTheDocument();
  });

  it('locks the form after a successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => ({
      ...reportSectionReadModelSchema.parse({
        ...createDemoSection(),
        status: 'submitted',
        submittedAt: new Date('2026-04-06T13:00:00.000Z'),
        projects: [
          {
            ...createDemoSection().projects[0]!,
            trafficLight: 'green',
          },
        ],
      }),
    }));

    render(
      <ReportSectionForm
        initialSection={{
          ...createDemoSection(),
          projects: [
            {
              ...createDemoSection().projects[0]!,
              trafficLight: 'green',
            },
          ],
        }}
        onSaveDraft={async () => createDemoSection()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Submit Section' }));
    await user.click(await screen.findByRole('button', { name: 'Submit Section' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      // toast fires in Sonner portal (outside JSDOM) — assert on the mock
      expect(toast.success).toHaveBeenCalled();
      // RadioGroup is a div — check child buttons are disabled
      const radioGroup = screen.getByLabelText('Project 1 traffic light');
      radioGroup.querySelectorAll('button').forEach((btn) => expect(btn).toBeDisabled());
      expect(screen.queryByRole('button', { name: 'Submit Section' })).not.toBeInTheDocument();
    });
  });
});
