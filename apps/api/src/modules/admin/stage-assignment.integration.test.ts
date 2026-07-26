import type {
  AdminSnapshot,
  AppSettings,
  StageAssignment,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { unusedAdminRepositoryStubs } from "./admin-repository-unused-stubs.js";
import type { AdminRepository } from "./admin-shared.js";
import { ProjectAdminService } from "./project-admin.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID_2 = "22222222-2222-4222-8222-222222222222";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const STAGE_ID_2 = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";
const PROJECT_ID_2 = "66666666-6666-4666-8666-666666666666";
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
      id: "00000000-0000-4000-8000-000000000001",
      email: "head@customreport.local",
      name: "Department Head",
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

// Fixture mirrors SQL defaults.
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
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
};

function createRepository(
  snapshot: AdminSnapshot = initialSnapshot,
  settings: AppSettings = defaultSettings,
): AdminRepository {
  let currentSnapshot = structuredClone(snapshot);
  let currentSettings = structuredClone(settings);
  const assignments = new Map<string, StageAssignment>();

  const notExercised = (): never => {
    throw new Error("not exercised by the stage-assignment integration suite");
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
    // Targeted entity writes — not exercised by the stage-assignment suite.
    upsertUser: notExercised,
    removeUser: notExercised,
    upsertProject: notExercised,
    removeProject: notExercised,
    upsertReminderRule: notExercised,
    removeReminderRule: notExercised,
  };
}

describe("ProjectAdminService — stage assignments (integration)", () => {
  it("creates a valid assignment and returns it", async () => {
    const service = new ProjectAdminService(createRepository());

    const created = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe(USER_ID);
    expect(created.stageId).toBe(STAGE_ID);
    expect(created.projectId).toBe(PROJECT_ID);
  });

  it("updates the assignee for the same project stage", async () => {
    const service = new ProjectAdminService(createRepository());

    const first = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    const second = await service.saveStageAssignment({
      userId: USER_ID_2,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(second.id).toBe(first.id);
    expect(second.userId).toBe(USER_ID_2);

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe(USER_ID_2);
  });

  it("deletes an assignment successfully", async () => {
    const service = new ProjectAdminService(createRepository());

    const created = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    const result = await service.deleteStageAssignment(created.id);
    expect(result).toEqual({ success: true });

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(0);
  });

  it("lists assignments filtered by project", async () => {
    const service = new ProjectAdminService(createRepository());

    await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });
    await service.saveStageAssignment({
      userId: USER_ID_2,
      stageId: STAGE_ID_2,
      projectId: PROJECT_ID,
    });
    await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID_2,
    });

    const listForProject1 = await service.listStageAssignments(PROJECT_ID);
    expect(listForProject1).toHaveLength(2);

    const listForProject2 = await service.listStageAssignments(PROJECT_ID_2);
    expect(listForProject2).toHaveLength(1);
  });
});
