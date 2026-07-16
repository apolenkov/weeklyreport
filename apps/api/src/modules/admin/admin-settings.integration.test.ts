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

/* ------------------------------------------------------------------ */
/*  Sessions & defaults                                                */
/* ------------------------------------------------------------------ */

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
  name: "Core Development",
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

// AppSettings carries 9 knobs beyond the legacy fields. The integration
// fixture mirrors the SQL defaults so the in-memory repo round-trips identical
// shape to the Prisma path.
// The legacy `departmentName` field was removed.
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

/* ------------------------------------------------------------------ */
/*  Repository factory                                                 */
/* ------------------------------------------------------------------ */

function createRepository(
  snapshot: AdminSnapshot,
  settings: AppSettings = defaultSettings,
): AdminRepository {
  let currentSnapshot = structuredClone(snapshot);
  let currentSettings = structuredClone(settings);
  const assignments = new Map<string, StageAssignment>();

  const notExercised = (): never => {
    throw new Error("not exercised by the settings integration suite");
  };

  return {
    ...unusedAdminRepositoryStubs(),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async getSnapshot() {
      return structuredClone(currentSnapshot);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async saveSnapshot(nextSnapshot) {
      currentSnapshot = structuredClone(nextSnapshot);
      return structuredClone(currentSnapshot);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async getSettings() {
      return structuredClone(currentSettings);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async updateSettings(data) {
      currentSettings = { ...currentSettings, ...data };
      return structuredClone(currentSettings);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
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
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async archiveReportingGroup(groupId) {
      const group = currentSnapshot.groups.find((row) => row.id === groupId);
      if (!group) throw new Error(`ReportingGroup ${groupId} not found.`);
      group.archived = true;
      return structuredClone(group);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async saveStageAssignment(data) {
      const key = `${data.userId}:${data.stageId}:${data.projectId}`;
      const existing = [...assignments.values()].find(
        (a) => `${a.userId}:${a.stageId}:${a.projectId}` === key,
      );
      if (existing) {
        return structuredClone(existing);
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
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async deleteStageAssignment(id) {
      if (!assignments.has(id)) {
        throw new Error(`StageAssignment ${id} not found.`);
      }
      assignments.delete(id);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async AdminRepository contract (no awaitable work in the stub)
    async listStageAssignments(projectId) {
      return [...assignments.values()]
        .filter((a) => a.projectId === projectId)
        .map((a) => structuredClone(a));
    },
    // Targeted entity writes — not exercised by the settings suite.
    upsertUser: notExercised,
    removeUser: notExercised,
    upsertProject: notExercised,
    removeProject: notExercised,
    upsertReminderRule: notExercised,
    removeReminderRule: notExercised,
    upsertPeriod: notExercised,
  };
}

/* ------------------------------------------------------------------ */
/*  Settings integration tests                                         */
/* ------------------------------------------------------------------ */

describe("SnapshotAdminService — settings (integration)", () => {
  it("returns default settings when nothing has been configured", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));
    const result = await service.getSettings();

    expect(result).toEqual(defaultSettings);
  });

  // round-trip the new fields through updateSettings.
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

  // round-trip the retained period-cycle knobs (a settings surface cleanup
  // removed the four consumer-less ones).
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
