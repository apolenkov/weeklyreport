import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  reportSectionReadModelSchema,
  type ReportSectionReadModel,
} from '@customreport/shared';

import { createDemoSection } from './demo-section';
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
    expect(screen.getByText('No risks added')).toBeInTheDocument();
    expect(screen.getByText('No decisions added')).toBeInTheDocument();
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
      expect(screen.getByText('Сохраняется...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalled();
      expect(screen.getByText('Сохранено')).toBeInTheDocument();
    });
  });

  it('rehydrates saved values after a successful draft save', async () => {
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
      expect(screen.getByDisplayValue('Saved from backend')).toBeInTheDocument();
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

    expect(screen.getByLabelText('Project 1 traffic light')).toBeDisabled();
    expect(screen.getByLabelText('Current item 1')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Submit section' })).not.toBeInTheDocument();
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

    expect(screen.getByText('Carried over from previous report')).toBeInTheDocument();
    expect(screen.getByText('Still unresolved')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Carry-over item 1 completed'));

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalled();
    });
  });
});
