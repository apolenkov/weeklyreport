import { describe, expect, it } from "vitest";

import type {
  AdminSnapshot,
  AppSettings,
  StageAssignment,
  UserSession,
} from "@customreport/shared";

import { adminRouter } from "./admin.router";
import {
  AdminAccessError,
  AdminService,
  type AdminRepository,
} from "./admin.service";

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
      role: "head",
      reportingGroupId: GROUP_ID,
      reportingGroupName: defaultGroup.name,
    },
  ],
  groups: [defaultGroup],
  projects: [],
  periods: [],
  reminderRules: [],
  reminderExecutions: [],
  policies: [],
};

// UFB-048 (Phase 48-B): AppSettings expanded with 9 new knobs. The integration
// fixture mirrors the SQL defaults so the in-memory repo round-trips identical
// shape to the Prisma path.
// UFB-047 / Phase 49-01: legacy `departmentName` field removed.
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

  return {
    async getSnapshot() {
      return structuredClone(currentSnapshot);
    },
    async saveSnapshot(nextSnapshot) {
      currentSnapshot = structuredClone(nextSnapshot);
      return structuredClone(currentSnapshot);
    },
    async getSettings() {
      return structuredClone(currentSettings);
    },
    async updateSettings(data) {
      currentSettings = { ...currentSettings, ...data };
      return structuredClone(currentSettings);
    },
    async saveReportingGroup(group) {
      const existingIndex = currentSnapshot.groups.findIndex(
        (row) => row.id === group.id,
      );
      if (existingIndex >= 0) {
        currentSnapshot.groups[existingIndex] = structuredClone(group);
      } else {
        currentSnapshot.groups.push(structuredClone(group));
      }
      return structuredClone(group);
    },
    async archiveReportingGroup(groupId) {
      const group = currentSnapshot.groups.find((row) => row.id === groupId);
      if (!group) throw new Error(`ReportingGroup ${groupId} not found.`);
      group.archived = true;
      return structuredClone(group);
    },
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
    async deleteStageAssignment(id) {
      if (!assignments.has(id)) {
        throw new Error(`StageAssignment ${id} not found.`);
      }
      assignments.delete(id);
    },
    async listStageAssignments(projectId) {
      return [...assignments.values()]
        .filter((a) => a.projectId === projectId)
        .map((a) => structuredClone(a));
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Settings integration tests                                         */
/* ------------------------------------------------------------------ */

describe("AdminService — settings (integration)", () => {
  it("returns default settings when nothing has been configured", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const result = await service.getSettings();

    expect(result).toEqual(defaultSettings);
  });

  // UFB-048: round-trip the new fields through updateSettings.
  it("UFB-048: round-trips the 9 new AppSettings fields", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

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
    const service = new AdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      autoCreatePeriods: true,
    });

    expect(result.autoCreatePeriods).toBe(true);
  });

  it("changes defaultDeadlineDays", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      defaultDeadlineDays: 10,
    });

    expect(result.defaultDeadlineDays).toBe(10);
  });

  it("admin router rejects non-head access to settings", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    await expect(
      adminRouter.getSnapshot({ adminService: service, session: leadSession }),
    ).rejects.toBeInstanceOf(AdminAccessError);
  });
});
