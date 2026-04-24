import {
  adminProjectSchema,
  adminReminderRuleSchema,
  adminSnapshotSchema,
  adminUserSchema,
  appSettingsSchema,
  appSettingsUpdateSchema,
  stageAssignmentSchema,
  reportPeriodSchema,
  type AdminProject,
  type AdminReminderRule,
  type AdminSnapshot,
  type AdminUser,
  type AppSettings,
  type ReportPeriod,
  type StageAssignment,
} from '@customreport/shared';

import { createNullLogger, type AppLogger } from '../../lib/logger';

export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAccessError';
  }
}

export interface AdminRepository {
  getSnapshot(): Promise<AdminSnapshot>;
  saveSnapshot(snapshot: AdminSnapshot): Promise<AdminSnapshot>;
  getSettings(): Promise<AppSettings>;
  updateSettings(data: Partial<AppSettings>): Promise<AppSettings>;
  saveStageAssignment(data: { userId: string; stageId: string; projectId: string }): Promise<StageAssignment>;
  deleteStageAssignment(id: string): Promise<void>;
  listStageAssignments(projectId: string): Promise<StageAssignment[]>;
}

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export class AdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /** API-11: Get application settings singleton. */
  async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  /** API-11: Update application settings (partial). */
  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const parsed = appSettingsUpdateSchema.parse(data);
    return appSettingsSchema.parse(await this.repository.updateSettings(parsed));
  }

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

    this.logger.info('upserted user', { userId: parsedUser.id });
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

  async removeProject(projectId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextProjects = snapshot.projects.map((row) =>
      row.id === projectId ? { ...row, archived: true } : row,
    );

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, projects: nextProjects }),
    );
  }

  /** API-12: Upsert a stage assignment (unique on userId+stageId+projectId). */
  async saveStageAssignment(data: {
    userId: string;
    stageId: string;
    projectId: string;
  }): Promise<StageAssignment> {
    return stageAssignmentSchema.parse(
      await this.repository.saveStageAssignment(data),
    );
  }

  /** API-12: Delete a stage assignment by ID. */
  async deleteStageAssignment(id: string): Promise<{ success: true }> {
    await this.repository.deleteStageAssignment(id);
    return { success: true };
  }

  /** API-12: List stage assignments for a project. */
  async listStageAssignments(projectId: string): Promise<StageAssignment[]> {
    const rows = await this.repository.listStageAssignments(projectId);
    return rows.map((r) => stageAssignmentSchema.parse(r));
  }

  async removeReminderRule(ruleId: string): Promise<AdminSnapshot> {
    const snapshot = await this.getSnapshot();
    const nextRules = snapshot.reminderRules.filter((row) => row.id !== ruleId);

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, reminderRules: nextRules }),
    );
  }
}
