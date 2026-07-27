import type {
  AdminSnapshot,
  AppSettings,
  StageAssignment,
  UserSession,
} from "@customreport/shared";

import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createNullAuditLogger } from "../../../lib/audit-logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import { unusedAdminRepositoryStubs } from "../admin-repository-unused-stubs.js";
import { type AdminRepository } from "../admin-shared.js";
import { SnapshotAdminService } from "../snapshot-admin.service.js";

export const adminSession: UserSession = {
  userId: "00000000-0000-4000-8000-0000000000ad",
  email: "admin@customreport.local",
  name: "Platform Admin",
  role: "admin",
  activeReportId: "22222222-2222-4222-8222-222222222222",
  activeReportSectionId: null,
};

// Drive the live adminProcedure, not a router copy — heads get FORBIDDEN.
export function buildAdminCaller(
  service: SnapshotAdminService,
  session: UserSession,
) {
  const deps = { snapshotAdminService: service } as unknown as Parameters<
    typeof createAppRouter
  >[0];

  return createAppRouter(deps).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

export const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: "22222222-2222-4222-8222-222222222222",
  activeReportSectionId: null,
};

export const leadSession: UserSession = {
  userId: "33333333-3333-4333-8333-333333333333",
  email: "lead1@customreport.local",
  name: "Lead 1",
  role: "lead",
  activeReportId: "22222222-2222-4222-8222-222222222222",
  activeReportSectionId: "11111111-1111-4111-8111-111111111111",
};

export const GROUP_ID = "99999999-9999-4999-8999-999999999991";
export const defaultGroup = {
  id: GROUP_ID,
  name: "Core Development",
  description: null,
  archived: false,
};

export const initialSnapshot: AdminSnapshot = {
  users: [
    {
      id: headSession.userId,
      email: headSession.email,
      name: headSession.name,
      lastName: "Department",
      firstName: "Head",
      middleName: null,
      position: null,
      role: "head",
      reportingGroupId: GROUP_ID,
      reportingGroupName: defaultGroup.name,
      isActive: true,
    },
  ],
  groups: [defaultGroup],
  projects: [],
  periods: [],
  reminderRules: [],
  reminderExecutions: [],
  policies: [],
};

// Period-cycle knobs (deadlineTime, allowReopenAfterPublish,
// reopenWindowHours) mirror the SQL defaults.
export const defaultSettings: AppSettings = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: null,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
};

export function createRepository(
  snapshot: AdminSnapshot,
  settings: AppSettings = defaultSettings,
): AdminRepository & {
  reminderPolicyExists(policyId: string): Promise<boolean>;
} {
  let currentSnapshot = structuredClone(snapshot);
  let currentSettings = structuredClone(settings);
  const assignments = new Map<string, StageAssignment>();

  return {
    ...unusedAdminRepositoryStubs(),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async getSnapshot() {
      return structuredClone(currentSnapshot);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async saveSnapshot(nextSnapshot) {
      currentSnapshot = structuredClone(nextSnapshot);
      return structuredClone(currentSnapshot);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async getSettings() {
      return structuredClone(currentSettings);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async updateSettings(data) {
      currentSettings = { ...currentSettings, ...data };
      return structuredClone(currentSettings);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async saveReportingGroup(group) {
      const existingIndex = currentSnapshot.groups.findIndex(
        (row) => row.id === group.id,
      );
      if (existingIndex !== -1) {
        currentSnapshot.groups[existingIndex] = structuredClone(group);
      } else {
        currentSnapshot.groups.push(structuredClone(group));
      }
      return structuredClone(group);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async archiveReportingGroup(groupId) {
      const group = currentSnapshot.groups.find((row) => row.id === groupId);
      if (!group) throw new Error(`ReportingGroup ${groupId} not found.`);
      group.archived = true;
      return structuredClone(group);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async saveStageAssignment(data) {
      const existing = [...assignments.values()].find(
        (a) => a.stageId === data.stageId && a.projectId === data.projectId,
      );
      if (existing) {
        const updated: StageAssignment = {
          ...existing,
          userId: data.userId,
        };
        assignments.set(existing.id, updated);
        return structuredClone(updated);
      }
      const assignment: StageAssignment = {
        id: crypto.randomUUID(),
        userId: data.userId,
        stageId: data.stageId,
        projectId: data.projectId,
        stageName: "Development",
        userName: "Test User",
      };
      assignments.set(assignment.id, assignment);
      return structuredClone(assignment);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async deleteStageAssignment(id) {
      if (!assignments.has(id)) {
        throw new Error(`StageAssignment ${id} not found.`);
      }
      assignments.delete(id);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async listStageAssignments(projectId) {
      return [...assignments.values()]
        .filter((a) => a.projectId === projectId)
        .map((a) => structuredClone(a));
    },
    // Targeted single-entity writes — each touches only the named row, mirroring
    // the prisma repository. Users/projects stay name-sorted so the read shape
    // matches getSnapshot's `orderBy name asc`.
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async upsertUser(user) {
      const exists = currentSnapshot.users.some((row) => row.id === user.id);
      const nextUsers = exists
        ? currentSnapshot.users.map((row) =>
            row.id === user.id ? structuredClone(user) : row,
          )
        : [...currentSnapshot.users, structuredClone(user)];
      currentSnapshot.users = [...nextUsers].sort((left, right) =>
        left.name.localeCompare(right.name, "ru"),
      );
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async removeUser(userId) {
      currentSnapshot.users = currentSnapshot.users.filter(
        (row) => row.id !== userId,
      );
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async upsertProject(project) {
      const exists = currentSnapshot.projects.some(
        (row) => row.id === project.id,
      );
      const nextProjects = exists
        ? currentSnapshot.projects.map((row) =>
            row.id === project.id ? structuredClone(project) : row,
          )
        : [...currentSnapshot.projects, structuredClone(project)];
      currentSnapshot.projects = [...nextProjects].sort((left, right) =>
        left.name.localeCompare(right.name, "ru"),
      );
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async removeProject(projectId) {
      currentSnapshot.projects = currentSnapshot.projects.map((row) =>
        row.id === projectId ? { ...row, archived: true } : row,
      );
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async upsertReminderRule(rule) {
      const exists = currentSnapshot.reminderRules.some(
        (row) => row.id === rule.id,
      );
      currentSnapshot.reminderRules = exists
        ? currentSnapshot.reminderRules.map((row) =>
            row.id === rule.id ? structuredClone(rule) : row,
          )
        : [...currentSnapshot.reminderRules, structuredClone(rule)];
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async removeReminderRule(ruleId) {
      currentSnapshot.reminderRules = currentSnapshot.reminderRules.filter(
        (row) => row.id !== ruleId,
      );
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async reminderPolicyExists(policyId) {
      return currentSnapshot.policies.some((policy) => policy.id === policyId);
    },
  };
}
