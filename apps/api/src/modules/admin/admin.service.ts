import {
  adminProjectSchema,
  adminReminderRuleSchema,
  adminSnapshotSchema,
  adminUserSchema,
  reportPeriodSchema,
  type AdminProject,
  type AdminReminderRule,
  type AdminSnapshot,
  type AdminUser,
  type ReportPeriod,
} from '@customreport/shared';

export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAccessError';
  }
}

export interface AdminRepository {
  getSnapshot(): Promise<AdminSnapshot>;
  saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot>;
}

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertUser(user: AdminUser): Promise<AdminSnapshot> {
    const parsedUser = adminUserSchema.parse(user);
    const snapshot = await this.getSnapshot();
    const nextUsers = sortByName(
      snapshot.users.some((row) => row.id === parsedUser.id)
        ? snapshot.users.map((row) => (row.id === parsedUser.id ? parsedUser : row))
        : [...snapshot.users, parsedUser],
    );

    return this.repository.saveSnapshot(adminSnapshotSchema.parse({ ...snapshot, users: nextUsers }));
  }

  async removeUser(userId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextUsers = snapshot.users.filter((row) => row.id !== userId);

    return this.repository.saveSnapshot(adminSnapshotSchema.parse({ ...snapshot, users: nextUsers }));
  }

  async upsertProject(project: AdminProject): Promise<AdminSnapshot> {
    const parsedProject = adminProjectSchema.parse(project);
    const snapshot = await this.getSnapshot();
    const nextProjects = sortByName(
      snapshot.projects.some((row) => row.id === parsedProject.id)
        ? snapshot.projects.map((row) => (row.id === parsedProject.id ? parsedProject : row))
        : [...snapshot.projects, parsedProject],
    );

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, projects: nextProjects }),
    );
  }

  async upsertPeriod(period: ReportPeriod): Promise<AdminSnapshot> {
    const parsedPeriod = reportPeriodSchema.parse(period);
    const snapshot = await this.getSnapshot();
    const nextPeriods = snapshot.periods.some((row) => row.id === parsedPeriod.id)
      ? snapshot.periods.map((row) => (row.id === parsedPeriod.id ? parsedPeriod : row))
      : [...snapshot.periods, parsedPeriod];

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, periods: nextPeriods }),
    );
  }

  async upsertReminderRule(rule: AdminReminderRule): Promise<AdminSnapshot> {
    const parsedRule = adminReminderRuleSchema.parse(rule);
    const snapshot = await this.getSnapshot();
    const nextRules = snapshot.reminderRules.some((row) => row.id === parsedRule.id)
      ? snapshot.reminderRules.map((row) => (row.id === parsedRule.id ? parsedRule : row))
      : [...snapshot.reminderRules, parsedRule];

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, reminderRules: nextRules }),
    );
  }
}
