import {
  adminReminderExecutionSchema,
  adminSnapshotSchema,
  adminUserSchema,
  adminProjectSchema,
  reportPeriodSchema,
  adminReminderRuleSchema,
  type AdminProject,
  type AdminReminderExecution,
  type AdminReminderRule,
  type AdminSnapshot,
  type AdminUser,
  type ReportPeriod,
} from '@customreport/shared';

export const ADMIN_SNAPSHOT_STORAGE_KEY = 'customreport:admin-snapshot';

export const defaultSnapshot: AdminSnapshot = {
  users: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'head@customreport.local',
      name: 'Department Head',
      role: 'head',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'lead1@customreport.local',
      name: 'Lead 1',
      role: 'lead',
    },
  ],
  projects: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Project 1',
      archived: false,
      leadId: '33333333-3333-4333-8333-333333333333',
      leadName: 'Lead 1',
    },
  ],
  periods: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      periodStart: new Date('2026-04-06T00:00:00.000Z'),
      periodEnd: new Date('2026-04-12T23:59:59.000Z'),
      deadline: new Date('2026-04-10T15:00:00.000Z'),
      status: 'draft',
    },
  ],
  reminderRules: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      reportId: '22222222-2222-4222-8222-222222222222',
      kind: 'deadline',
      fireAt: new Date('2026-04-10T09:00:00.000Z'),
      timezone: 'Europe/Moscow',
      status: 'active',
      version: 1,
    },
  ],
  reminderExecutions: [],
};

export function readAdminSnapshot(): AdminSnapshot {
  if (typeof window === 'undefined') {
    return defaultSnapshot;
  }

  const rawValue = window.localStorage.getItem(ADMIN_SNAPSHOT_STORAGE_KEY);

  if (!rawValue) {
    return defaultSnapshot;
  }

  return adminSnapshotSchema.parse(JSON.parse(rawValue));
}

export function persistAdminSnapshot(snapshot: AdminSnapshot): AdminSnapshot {
  const parsedSnapshot = adminSnapshotSchema.parse(snapshot);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ADMIN_SNAPSHOT_STORAGE_KEY, JSON.stringify(parsedSnapshot));
  }

  return parsedSnapshot;
}

export function upsertAdminUser(snapshot: AdminSnapshot, user: AdminUser): AdminSnapshot {
  const parsedUser = adminUserSchema.parse(user);
  const nextUsers = snapshot.users.some((row) => row.id === parsedUser.id)
    ? snapshot.users.map((row) => (row.id === parsedUser.id ? parsedUser : row))
    : [...snapshot.users, parsedUser];

  return adminSnapshotSchema.parse({ ...snapshot, users: nextUsers });
}

export function removeAdminUser(snapshot: AdminSnapshot, userId: string): AdminSnapshot {
  return adminSnapshotSchema.parse({
    ...snapshot,
    users: snapshot.users.filter((row) => row.id !== userId),
  });
}

export function upsertAdminProject(snapshot: AdminSnapshot, project: AdminProject): AdminSnapshot {
  const parsedProject = adminProjectSchema.parse(project);
  const nextProjects = snapshot.projects.some((row) => row.id === parsedProject.id)
    ? snapshot.projects.map((row) => (row.id === parsedProject.id ? parsedProject : row))
    : [...snapshot.projects, parsedProject];

  return adminSnapshotSchema.parse({ ...snapshot, projects: nextProjects });
}

export function upsertReportPeriod(snapshot: AdminSnapshot, period: ReportPeriod): AdminSnapshot {
  const parsedPeriod = reportPeriodSchema.parse(period);
  const nextPeriods = snapshot.periods.some((row) => row.id === parsedPeriod.id)
    ? snapshot.periods.map((row) => (row.id === parsedPeriod.id ? parsedPeriod : row))
    : [...snapshot.periods, parsedPeriod];

  return adminSnapshotSchema.parse({ ...snapshot, periods: nextPeriods });
}

export function upsertAdminReminderRule(
  snapshot: AdminSnapshot,
  rule: AdminReminderRule,
): AdminSnapshot {
  const parsedRule = adminReminderRuleSchema.parse(rule);
  const nextRules = snapshot.reminderRules.some((row) => row.id === parsedRule.id)
    ? snapshot.reminderRules.map((row) => (row.id === parsedRule.id ? parsedRule : row))
    : [...snapshot.reminderRules, parsedRule];

  return adminSnapshotSchema.parse({ ...snapshot, reminderRules: nextRules });
}

export function requestAdminReminderExecution(
  snapshot: AdminSnapshot,
  ruleId: string,
  recipientEmail: string,
): AdminSnapshot {
  const rule = snapshot.reminderRules.find((row) => row.id === ruleId);

  if (!rule || rule.status !== 'active') {
    return snapshot;
  }

  const dedupeKey = `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`;
  const existingExecution = snapshot.reminderExecutions.find(
    (row) => row.dedupeKey === dedupeKey,
  );

  if (existingExecution) {
    return snapshot;
  }

  const nextExecution: AdminReminderExecution = adminReminderExecutionSchema.parse({
    id: crypto.randomUUID(),
    ruleId: rule.id,
    reportId: rule.reportId,
    dedupeKey,
    status: 'queued',
    scheduledFor: rule.fireAt,
    sentAt: null,
    recipientEmail,
    errorMessage: null,
  });

  return adminSnapshotSchema.parse({
    ...snapshot,
    reminderExecutions: [...snapshot.reminderExecutions, nextExecution],
  });
}

export function markAdminReminderSent(
  snapshot: AdminSnapshot,
  executionId: string,
): AdminSnapshot {
  return adminSnapshotSchema.parse({
    ...snapshot,
    reminderExecutions: snapshot.reminderExecutions.map((row) =>
      row.id === executionId
        ? {
            ...row,
            status: 'sent',
            sentAt: new Date(),
          }
        : row,
    ),
  });
}
