import type {
  AdminSnapshot,
  AppSettings,
  StageAssignment,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { unusedAdminRepositoryStubs } from "./admin-repository-unused-stubs.js";
import type { AdminRepository } from "./admin-shared.js";
import { SnapshotAdminService } from "./snapshot-admin.service.js";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: "22222222-2222-4222-8222-222222222222",
  activeReportSectionId: null,
};

const leadSession: UserSession = {
  userId: "33333333-3333-4333-8333-333333333333",
  email: "lead1@customreport.local",
  name: "Lead 1",
  role: "lead",
  activeReportId: "22222222-2222-4222-8222-222222222222",
  activeReportSectionId: "11111111-1111-4111-8111-111111111111",
};

const GROUP_ID = "99999999-9999-4999-8999-999999999991";
const defaultGroup = {
  id: GROUP_ID,
  name: "Software Development",
  description: null,
  archived: false,
};

const initialSnapshot: AdminSnapshot = {
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

// Fixture mirrors SQL defaults so the in-memory repo matches the Prisma path.
const defaultSettings: AppSettings = {
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
  // Period-cycle knobs at SQL defaults.
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
};

function createRepository(
  snapshot: AdminSnapshot,
  settings: AppSettings = defaultSettings,
): AdminRepository {
  // A repository double has to remember writes across calls, so these three
  // cells are rebound; every write derives a new value instead of mutating.
  let currentSnapshot = structuredClone(snapshot);
  let currentSettings = structuredClone(settings);
  let assignments: readonly StageAssignment[] = [];

  const notExercised = (): never => {
    throw new Error("not exercised by the settings integration suite");
  };

  return {
    ...unusedAdminRepositoryStubs(),
    getSnapshot() {
      return Promise.resolve(structuredClone(currentSnapshot));
    },
    saveSnapshot(nextSnapshot) {
      currentSnapshot = structuredClone(nextSnapshot);
      return Promise.resolve(structuredClone(currentSnapshot));
    },
    getSettings() {
      return Promise.resolve(structuredClone(currentSettings));
    },
    updateSettings(data) {
      currentSettings = { ...currentSettings, ...data };
      return Promise.resolve(structuredClone(currentSettings));
    },
    saveReportingGroup(group) {
      const exists = currentSnapshot.groups.some((row) => row.id === group.id);
      currentSnapshot = {
        ...currentSnapshot,
        groups: exists
          ? currentSnapshot.groups.map((row) =>
              row.id === group.id ? structuredClone(group) : row,
            )
          : [...currentSnapshot.groups, structuredClone(group)],
      };
      return Promise.resolve(structuredClone(group));
    },
    archiveReportingGroup(groupId) {
      const group = currentSnapshot.groups.find((row) => row.id === groupId);
      if (!group)
        return Promise.reject(
          new Error(`ReportingGroup ${groupId} not found.`),
        );
      const archived = { ...group, archived: true };
      currentSnapshot = {
        ...currentSnapshot,
        groups: currentSnapshot.groups.map((row) =>
          row.id === groupId ? archived : row,
        ),
      };
      return Promise.resolve(structuredClone(archived));
    },
    saveStageAssignment(data) {
      const key = `${data.userId}:${data.stageId}:${data.projectId}`;
      const existing = assignments.find(
        (a) => `${a.userId}:${a.stageId}:${a.projectId}` === key,
      );
      if (existing) {
        return Promise.resolve(structuredClone(existing));
      }
      const assignment: StageAssignment = {
        id: crypto.randomUUID(),
        userId: data.userId,
        stageId: data.stageId,
        projectId: data.projectId,
        stageName: "Development",
        userName: "Test User",
      };
      assignments = [...assignments, assignment];
      return Promise.resolve(structuredClone(assignment));
    },
    deleteStageAssignment(id) {
      if (!assignments.some((a) => a.id === id)) {
        return Promise.reject(new Error(`StageAssignment ${id} not found.`));
      }
      assignments = assignments.filter((a) => a.id !== id);
      return Promise.resolve();
    },
    listStageAssignments(projectId) {
      return Promise.resolve(
        assignments
          .filter((a) => a.projectId === projectId)
          .map((a) => structuredClone(a)),
      );
    },
    // Targeted entity writes — not exercised by the settings suite.
    upsertUser: notExercised,
    removeUser: notExercised,
    upsertProject: notExercised,
    removeProject: notExercised,
    upsertReminderRule: notExercised,
    removeReminderRule: notExercised,
  };
}

describe("SnapshotAdminService — settings (integration)", () => {
  it("returns default settings when nothing has been configured", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));
    const result = await service.getSettings();

    expect(result).toEqual(defaultSettings);
  });

  it("round-trips the 9 new AppSettings fields", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      periodLengthDays: 14,
      workingDays: "mon-sat",
      gracePeriodHours: 48,
      defaultTimezone: "Asia/Yekaterinburg",
      defaultReminderAudience: "head-of-late",
      notificationFromEmail: "reports@example.com",
      allowLateSubmissions: false,
      autoPublishAfterDeadline: true,
      autoArchiveWeeksAfterPublish: 12,
    });

    expect(result.periodLengthDays).toBe(14);
    expect(result.workingDays).toBe("mon-sat");
    expect(result.gracePeriodHours).toBe(48);
    expect(result.defaultTimezone).toBe("Asia/Yekaterinburg");
    expect(result.defaultReminderAudience).toBe("head-of-late");
    expect(result.notificationFromEmail).toBe("reports@example.com");
    expect(result.allowLateSubmissions).toBe(false);
    expect(result.autoPublishAfterDeadline).toBe(true);
    expect(result.autoArchiveWeeksAfterPublish).toBe(12);
    // legacy fields preserved
    expect(result.defaultDeadlineDays).toBe(5);
  });

  it("toggles autoCreatePeriods", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      autoCreatePeriods: true,
    });

    expect(result.autoCreatePeriods).toBe(true);
  });

  it("changes defaultDeadlineDays", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      defaultDeadlineDays: 10,
    });

    expect(result.defaultDeadlineDays).toBe(10);
  });

  it("round-trips the period-cycle AppSettings fields", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      deadlineTime: "09:30",
      allowReopenAfterPublish: false,
      reopenWindowHours: 24,
    });

    expect(result.deadlineTime).toBe("09:30");
    expect(result.allowReopenAfterPublish).toBe(false);
    expect(result.reopenWindowHours).toBe(24);
    // legacy fields preserved by the PATCH semantics
    expect(result.defaultDeadlineDays).toBe(5);
    expect(result.periodLengthDays).toBe(7);
    expect(result.allowLateSubmissions).toBe(true);
  });

  it("returns defaults for the period-cycle fields when nothing has been configured", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));
    const result = await service.getSettings();

    expect(result.deadlineTime).toBe("18:00");
    expect(result.allowReopenAfterPublish).toBe(true);
    expect(result.reopenWindowHours).toBe(72);
  });

  it("admin.snapshot rejects non-admin access at the live procedure gate", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));
    const deps = { snapshotAdminService: service } as unknown as Parameters<
      typeof createAppRouter
    >[0];
    const caller = createAppRouter(deps).createCaller({
      session: leadSession,
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.admin.snapshot()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
