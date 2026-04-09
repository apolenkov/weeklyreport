'use client';

import React from 'react';
import { useState } from 'react';

import type {
  AdminProject,
  AdminReminderRule,
  AdminSnapshot,
  AdminUser,
  ReportPeriod,
  Role,
} from '@customreport/shared';

void React;

type AdminPanelProps = {
  initialSnapshot: AdminSnapshot;
  onUpsertUser: (user: AdminUser) => Promise<AdminSnapshot>;
  onRemoveUser: (userId: string) => Promise<AdminSnapshot>;
  onUpsertProject: (project: AdminProject) => Promise<AdminSnapshot>;
  onUpsertPeriod: (period: ReportPeriod) => Promise<AdminSnapshot>;
  onUpsertReminderRule: (rule: AdminReminderRule) => Promise<AdminSnapshot>;
  onRunCarryOver: () => Promise<boolean>;
  onRequestReminderExecution: (
    ruleId: string,
    recipientEmail: string,
  ) => Promise<AdminSnapshot>;
};

function buildUserId(): string {
  return crypto.randomUUID();
}

export function AdminPanel({
  initialSnapshot,
  onRemoveUser,
  onUpsertPeriod,
  onUpsertProject,
  onRunCarryOver,
  onRequestReminderExecution,
  onUpsertReminderRule,
  onUpsertUser,
}: AdminPanelProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [carryOverMessage, setCarryOverMessage] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<Role>('lead');

  async function handleAddUser() {
    const nextSnapshot = await onUpsertUser({
      id: buildUserId(),
      email: userEmail,
      name: userName,
      role: userRole,
    });

    setSnapshot(nextSnapshot);
    setUserName('');
    setUserEmail('');
    setUserRole('lead');
  }

  async function handleBootstrapProject() {
    const lead = snapshot.users.find((row) => row.role === 'lead');
    if (!lead) return;
    setSnapshot(
      await onUpsertProject({
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Project Bootstrap',
        archived: false,
        leadId: lead.id,
        leadName: lead.name,
      }),
    );
  }

  async function handleBootstrapPeriod() {
    setSnapshot(
      await onUpsertPeriod({
        id: '88888888-8888-4888-8888-888888888888',
        periodStart: new Date('2026-04-20T00:00:00.000Z'),
        periodEnd: new Date('2026-04-26T23:59:59.000Z'),
        deadline: new Date('2026-04-24T15:00:00.000Z'),
        status: 'draft',
      }),
    );
  }

  async function handleBootstrapReminderRule() {
    const firstPeriod = snapshot.periods[0];
    if (!firstPeriod) return;
    setSnapshot(
      await onUpsertReminderRule({
        id: '99999999-9999-4999-8999-999999999998',
        reportId: firstPeriod.id,
        kind: 'deadline',
        fireAt: new Date('2026-04-24T09:00:00.000Z'),
        timezone: 'Europe/Moscow',
        status: 'active',
        version: 1,
      }),
    );
  }

  function describeLatestExecution(ruleId: string): string | null {
    const latestExecution = snapshot.reminderExecutions
      .filter((row) => row.ruleId === ruleId)
      .at(-1);

    if (!latestExecution) {
      return null;
    }

    return `${latestExecution.recipientEmail} — ${latestExecution.status}`;
  }

  async function handleRunReminder(rule: AdminReminderRule) {
    const leadRecipient = snapshot.users.find((row) => row.role === 'lead')?.email;

    if (!leadRecipient) {
      return;
    }

    setSnapshot(await onRequestReminderExecution(rule.id, leadRecipient));
  }

  async function handleRunCarryOver() {
    const completed = await onRunCarryOver();
    setCarryOverMessage(completed ? 'Carry-over completed' : 'Carry-over skipped');
  }

  return (
    <section>
      <h1>Admin Panel</h1>
      <section>
        <h2>Users</h2>
        <label>
          New user name
          <input aria-label="New user name" onChange={(e) => setUserName(e.currentTarget.value)} value={userName} />
        </label>
        <label>
          New user email
          <input aria-label="New user email" onChange={(e) => setUserEmail(e.currentTarget.value)} value={userEmail} />
        </label>
        <label>
          New user role
          <select aria-label="New user role" onChange={(e) => setUserRole(e.currentTarget.value as Role)} value={userRole}>
            <option value="lead">lead</option>
            <option value="head">head</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <button onClick={() => void handleAddUser()} type="button">Add user</button>
        <ul>
          {snapshot.users.map((user) => (
            <li key={user.id}>
              <span>{user.name}</span>
              {user.role !== 'head' ? (
                <button onClick={() => void onRemoveUser(user.id).then(setSnapshot)} type="button">
                  Remove user
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Projects</h2>
        <button onClick={() => void handleBootstrapProject()} type="button">Add project</button>
        <ul>{snapshot.projects.map((project) => <li key={project.id}>{project.name}</li>)}</ul>
      </section>
      <section>
        <h2>Report Periods</h2>
        <button onClick={() => void handleBootstrapPeriod()} type="button">Add period</button>
        <button onClick={() => void handleRunCarryOver()} type="button">Run carry-over</button>
        {carryOverMessage ? <p>{carryOverMessage}</p> : null}
        <ul>{snapshot.periods.map((period) => <li key={period.id}>{period.id}</li>)}</ul>
      </section>
      <section>
        <h2>Reminder Rules</h2>
        <button onClick={() => void handleBootstrapReminderRule()} type="button">Add reminder rule</button>
        <ul>
          {snapshot.reminderRules.map((rule) => {
            const latestExecution = describeLatestExecution(rule.id);

            return (
              <li key={rule.id}>
                <span>{rule.kind}</span>
                <button onClick={() => void handleRunReminder(rule)} type="button">
                  Run reminder
                </button>
                {latestExecution ? <p>{latestExecution}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
