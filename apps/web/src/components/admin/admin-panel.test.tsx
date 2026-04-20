import React from 'react';
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import type { AdminSnapshot } from '@customreport/shared';

import { AdminPanel } from './admin-panel';

void React;

afterEach(() => {
  cleanup();
});

const snapshot: AdminSnapshot = {
  periods: [],
  projects: [],
  reminderExecutions: [],
  reminderRules: [],
  users: [
    {
      email: 'head@customreport.local',
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Department Head',
      role: 'head',
    },
  ],
};

describe('AdminPanel', () => {
  it('renders admin lists and controls', () => {
    render(
      <AdminPanel
        initialSnapshot={snapshot}
        onRemoveUser={async () => snapshot}
        onRunCarryOver={async () => true}
        onRequestReminderExecution={async () => snapshot}
        onUpsertPeriod={async () => snapshot}
        onUpsertProject={async () => snapshot}
        onUpsertReminderRule={async () => snapshot}
        onUpsertUser={async () => snapshot}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeInTheDocument();
    expect(screen.getByText('Department Head')).toBeInTheDocument();
    // Button name is "Add User" (capital U) — matches the component exactly
    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument();
  });

  it('adds a user through the panel controls', async () => {
    const user = userEvent.setup();
    const onUpsertUser = vi.fn(async (nextUser) => ({
      ...snapshot,
      users: [...snapshot.users, nextUser],
    }));

    render(
      <AdminPanel
        initialSnapshot={snapshot}
        onRemoveUser={async () => snapshot}
        onRunCarryOver={async () => true}
        onRequestReminderExecution={async () => snapshot}
        onUpsertPeriod={async () => snapshot}
        onUpsertProject={async () => snapshot}
        onUpsertReminderRule={async () => snapshot}
        onUpsertUser={onUpsertUser}
      />,
    );

    // Open the CrudSheet slide-over by clicking "Add User"
    await user.click(screen.getByRole('button', { name: 'Add User' }));

    // The sheet is now open — fill in the form fields (labels are "Name", "Email", "Role")
    await user.type(await screen.findByLabelText('Name'), 'Lead 1');
    await user.type(screen.getByLabelText('Email'), 'lead1@customreport.local');

    // The sheet submit button also says "Add User"
    await user.click(screen.getAllByRole('button', { name: 'Add User' }).at(-1)!);

    await waitFor(() => {
      expect(onUpsertUser).toHaveBeenCalled();
      expect(screen.getByText('Lead 1')).toBeInTheDocument();
    });
  });

  it('shows reminder execution status and dedupe-safe triggering', async () => {
    const user = userEvent.setup();
    const reminderSnapshot: AdminSnapshot = {
      ...snapshot,
      users: [
        ...snapshot.users,
        {
          email: 'lead1@customreport.local',
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Lead 1',
          role: 'lead',
        },
      ],
      periods: [
        {
          deadline: new Date('2026-04-24T15:00:00.000Z'),
          id: '88888888-8888-4888-8888-888888888888',
          periodEnd: new Date('2026-04-26T23:59:59.000Z'),
          periodStart: new Date('2026-04-20T00:00:00.000Z'),
          status: 'draft',
        },
      ],
      reminderExecutions: [],
      reminderRules: [
        {
          fireAt: new Date('2026-04-24T09:00:00.000Z'),
          id: '99999999-9999-4999-8999-999999999998',
          kind: 'deadline',
          reportId: '88888888-8888-4888-8888-888888888888',
          status: 'active',
          timezone: 'Europe/Moscow',
          version: 1,
        },
      ],
    };

    const onRequestReminderExecution = vi.fn(
      async (_ruleId: string, _recipientEmail: string): Promise<AdminSnapshot> => ({
      ...reminderSnapshot,
      reminderExecutions: [
        {
          dedupeKey: '99999999-9999-4999-8999-999999999998:2026-04-24T09:00:00.000Z:lead1@customreport.local',
          errorMessage: null,
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          recipientEmail: 'lead1@customreport.local',
          reportId: '88888888-8888-4888-8888-888888888888',
          ruleId: '99999999-9999-4999-8999-999999999998',
          scheduledFor: new Date('2026-04-24T09:00:00.000Z'),
          sentAt: new Date('2026-04-24T09:00:01.000Z'),
          status: 'sent' as const,
        },
      ],
    }),
    );

    render(
      <AdminPanel
        initialSnapshot={reminderSnapshot}
        onRemoveUser={async () => reminderSnapshot}
        onRunCarryOver={async () => true}
        onRequestReminderExecution={onRequestReminderExecution}
        onUpsertPeriod={async () => reminderSnapshot}
        onUpsertProject={async () => reminderSnapshot}
        onUpsertReminderRule={async () => reminderSnapshot}
        onUpsertUser={async () => reminderSnapshot}
      />,
    );

    // Navigate to Reminders tab first
    await user.click(screen.getByRole('tab', { name: /reminders/i }));

    // Click the "Run" button in the reminders table
    await user.click(await screen.findByRole('button', { name: 'Run' }));

    // Confirm in the dialog
    await user.click(await screen.findByRole('button', { name: 'Send Reminder' }));

    await waitFor(() => {
      expect(onRequestReminderExecution).toHaveBeenCalled();
      expect(screen.getByText('lead1@customreport.local -- sent')).toBeInTheDocument();
    });
  });

  it('shows carry-over completion feedback when rollover runs', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        initialSnapshot={snapshot}
        onRemoveUser={async () => snapshot}
        onRunCarryOver={async () => true}
        onRequestReminderExecution={async () => snapshot}
        onUpsertPeriod={async () => snapshot}
        onUpsertProject={async () => snapshot}
        onUpsertReminderRule={async () => snapshot}
        onUpsertUser={async () => snapshot}
      />,
    );

    // Navigate to Periods tab
    await user.click(screen.getByRole('tab', { name: /periods/i }));

    // Click "Run Carry-Over" button — this opens a ConfirmDialog
    await user.click(await screen.findByRole('button', { name: 'Run Carry-Over' }));

    // Confirm in the dialog
    await user.click(await screen.findByRole('button', { name: 'Run Carry-Over' }));

    await waitFor(() => {
      // toast.success fires in Sonner portal (outside JSDOM) — assert on the mock
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Carry-over'), expect.anything());
    });
  });
});
