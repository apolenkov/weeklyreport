import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  reportSectionReadModelSchema,
  type ReportSectionReadModel,
} from '@customreport/shared';

import { createDemoSection } from '../../test/fixtures';
import { ReportSectionForm } from './report-section-form';

void React;

function renderForm(
  overrides: Partial<{
    initialSection: ReportSectionReadModel;
    onSaveDraft: (section: unknown) => Promise<ReportSectionReadModel>;
    onSubmit: (section: unknown) => Promise<ReportSectionReadModel>;
  }> = {},
) {
  const initialSection = overrides.initialSection ?? createDemoSection();
  const onSaveDraft =
    overrides.onSaveDraft ?? vi.fn(async () => initialSection);
  const onSubmit =
    overrides.onSubmit ??
      vi.fn(async () =>
        reportSectionReadModelSchema.parse({
          ...initialSection,
          status: 'submitted',
          submittedAt: new Date(),
        }),
      );

  render(
    <ReportSectionForm
      initialSection={initialSection}
      onSaveDraft={onSaveDraft}
      onSubmit={onSubmit}
    />,
  );

  return { initialSection, onSaveDraft, onSubmit };
}

describe('ReportSectionForm', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders project status, items, risks, decisions, and exactly three priorities', () => {
    renderForm();

    expect(screen.getByLabelText('Project 1 traffic light')).toBeInTheDocument();
    expect(screen.getByLabelText('Current item 1')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Priority \d/)).toHaveLength(3);
    // Empty state texts from the redesigned subcomponents
    expect(screen.getByText('Активных рисков нет')).toBeInTheDocument();
    expect(screen.getByText('Нет решений, требующих внимания')).toBeInTheDocument();
  });

  it('shows autosave transitions after a debounced change', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn(
      async (input: unknown) =>
        new Promise<ReportSectionReadModel>((resolve) => {
          window.setTimeout(() => {
            resolve(
              reportSectionReadModelSchema.parse({
                ...createDemoSection(),
                ...(input as object),
                status: 'draft',
                submittedAt: null,
                projects: createDemoSection().projects.map((project) => ({
                  ...project,
                  trafficLight:
                    (input as { projectStatuses: Array<{ projectId: string; status?: 'green' | 'yellow' | 'red' }> })
                      .projectStatuses.find((status) => status.projectId === project.projectId)
                      ?.status ?? null,
                })),
              }),
            );
          }, 50);
        }),
    );
    renderForm({ onSaveDraft });

    await user.type(screen.getByLabelText('Current item 1'), ' updated');

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalled();
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  it('preserves local text after a successful draft save', async () => {
    const user = userEvent.setup();
    const savedSection = {
      ...createDemoSection(),
      items: [
        {
          ...createDemoSection().items[0]!,
          text: 'Saved from backend',
        },
      ],
    };
    const onSaveDraft = vi.fn(async () => savedSection);

    renderForm({ onSaveDraft });

    await user.clear(screen.getByLabelText('Current item 1'));
    await user.type(screen.getByLabelText('Current item 1'), 'New text');

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalled();
      // Local state is preserved — not overwritten by backend response
      expect(screen.getByDisplayValue('New text')).toBeInTheDocument();
    });
  });

  it('renders the entire form in read-only mode for submitted sections', () => {
    renderForm({
      initialSection: {
        ...createDemoSection(),
        status: 'submitted',
        submittedAt: new Date('2026-04-06T12:00:00.000Z'),
      },
    });

    // RadioGroup is a div — check its child buttons are disabled
    const radioGroup = screen.getByLabelText('Project 1 traffic light');
    radioGroup.querySelectorAll('button').forEach((btn) => expect(btn).toBeDisabled());
    expect(screen.getByLabelText('Current item 1')).toBeDisabled();
    // In read-only mode the submit button is not shown
    expect(screen.queryByRole('button', { name: 'Submit Section' })).not.toBeInTheDocument();
  });

  it('shows carried-over items and unresolved decisions in the next period', async () => {
    const carriedSection = reportSectionReadModelSchema.parse({
      ...createDemoSection(),
      items: [
        {
          ...createDemoSection().items[0]!,
          carriedOver: true,
          completed: false,
          text: 'Carried from previous report',
          type: 'current',
        },
      ],
      decisions: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          text: 'Still unresolved',
          owner: 'Department Head',
          deadline: null,
          impact: 'Needs action',
          resolvedAt: null,
        },
      ],
    });
    const user = userEvent.setup();
    const onSaveDraft = vi.fn(async () => carriedSection);

    renderForm({ initialSection: carriedSection, onSaveDraft });

    expect(screen.getByText('Carried Over')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Still unresolved')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Carry-over item 1 completed'));

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalled();
    });
  });
});
