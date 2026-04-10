import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

    await user.click(screen.getByRole('button', { name: 'Submit section' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Вы уверены?');
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

    await user.click(screen.getByRole('button', { name: 'Submit section' }));
    await user.click(screen.getByRole('button', { name: 'Confirm submit' }));

    expect(screen.getByText(/must have a traffic light status/i)).toBeInTheDocument();
    expect(screen.getByText(/needs at least one Current Week item/i)).toBeInTheDocument();
    expect(screen.getByText(/Top 3 priorities must be filled/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Submit section' }));
    await user.click(screen.getByRole('button', { name: 'Confirm submit' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(screen.getByText('Секция отправлена')).toBeInTheDocument();
      expect(screen.getByLabelText('Project 1 traffic light')).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Submit section' })).not.toBeInTheDocument();
    });
  });
});
