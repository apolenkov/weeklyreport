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
import { expectDefined } from "../../test-utils/expect-defined.js";

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

// UFB-048 (Phase 48-B): AppSettings expanded with 9 new knobs.
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

describe("AdminService", () => {
  it("adds and removes users", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const withLead = await service.upsertUser({
      email: leadSession.email,
      id: leadSession.userId,
      name: leadSession.name,
      role: "lead",
      reportingGroupId: GROUP_ID,
    });

    expect(withLead.users).toHaveLength(2);

    const withoutLead = await service.removeUser(leadSession.userId);

    expect(withoutLead.users).toHaveLength(1);
  });

  it("creates and archives reporting groups", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const groupId = "99999999-9999-4999-8999-999999999992";

    const created = await service.upsertReportingGroup({
      id: groupId,
      name: "Platform Guild",
      description: "Platform reporting group",
      archived: false,
    });
    const updated = await service.upsertReportingGroup({
      ...created,
      name: "Platform Guild 2",
    });
    const archived = await service.archiveReportingGroup(groupId);

    expect(created.name).toBe("Platform Guild");
    expect(updated.name).toBe("Platform Guild 2");
    expect(archived.archived).toBe(true);
  });

  it("UFB-042: persists headUserId round-trip on upsertReportingGroup", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const groupId = "99999999-9999-4999-8999-000000042000";
    const leaderId = "00000000-0000-4000-8000-000000000099";

    const created = await service.upsertReportingGroup({
      id: groupId,
      name: "Group with leader",
      description: null,
      archived: false,
      headUserId: leaderId,
    });
    expect(created.headUserId).toBe(leaderId);

    const cleared = await service.upsertReportingGroup({
      ...created,
      headUserId: null,
    });
    expect(cleared.headUserId).toBeNull();

    const restored = await service.upsertReportingGroup({
      ...cleared,
      headUserId: leaderId,
    });
    expect(restored.headUserId).toBe(leaderId);
  });

  it("creates projects, periods, and reminder rules", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const withProject = await service.upsertProject({
      archived: false,
      id: "44444444-4444-4444-8444-444444444444",
      leadId: leadSession.userId,
      leadName: leadSession.name,
      name: "Project 1",
    });
    const withPeriod = await service.upsertPeriod({
      deadline: new Date("2026-04-17T15:00:00.000Z"),
      id: "55555555-5555-4555-8555-555555555555",
      periodEnd: new Date("2026-04-19T23:59:59.000Z"),
      periodStart: new Date("2026-04-13T00:00:00.000Z"),
      status: "draft",
    });
    const withRule = await service.upsertReminderRule({
      fireAt: new Date("2026-04-17T09:00:00.000Z"),
      id: "66666666-6666-4666-8666-666666666666",
      kind: "deadline",
      reportId: "55555555-5555-4555-8555-555555555555",
      status: "active",
      timezone: "Europe/Moscow",
      version: 1,
      policyId: null,
    });

    expect(withProject.projects).toHaveLength(1);
    expect(withPeriod.periods).toHaveLength(1);
    expect(withRule.reminderRules).toHaveLength(1);
  });

  it("rejects non-head access in the router layer", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    await expect(
      adminRouter.getSnapshot({ adminService: service, session: leadSession }),
    ).rejects.toBeInstanceOf(AdminAccessError);
  });

  // -----------------------------------------------------------------------
  // P0/P1 Regression — ADM scenarios
  // -----------------------------------------------------------------------

  describe("getSnapshot — regression (ADM-010)", () => {
    it("returns snapshot with all entity types", async () => {
      const fullSnapshot: AdminSnapshot = {
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
        projects: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            name: "Project X",
            archived: false,
            leadId: headSession.userId,
            leadName: headSession.name,
          },
        ],
        periods: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            periodStart: new Date("2026-04-13T00:00:00.000Z"),
            periodEnd: new Date("2026-04-19T23:59:59.000Z"),
            deadline: new Date("2026-04-17T15:00:00.000Z"),
            status: "draft",
          },
        ],
        reminderRules: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            reportId: "55555555-5555-4555-8555-555555555555",
            kind: "deadline",
            fireAt: new Date("2026-04-17T09:00:00.000Z"),
            timezone: "Europe/Moscow",
            status: "active",
            version: 1,
            policyId: null,
          },
        ],
        reminderExecutions: [],
        policies: [],
      };

      const service = new AdminService(createRepository(fullSnapshot));
      const result = await service.getSnapshot();

      expect(result.users).toHaveLength(1);
      expect(result.projects).toHaveLength(1);
      expect(result.periods).toHaveLength(1);
      expect(result.reminderRules).toHaveLength(1);
      expect(result.reminderExecutions).toHaveLength(0);
    });

    it("returns empty snapshot when no entities exist", async () => {
      const emptySnapshot: AdminSnapshot = {
        users: [],
        groups: [],
        projects: [],
        periods: [],
        reminderRules: [],
        reminderExecutions: [],
        policies: [],
      };

      const service = new AdminService(createRepository(emptySnapshot));
      const result = await service.getSnapshot();

      expect(result.users).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.periods).toEqual([]);
      expect(result.reminderRules).toEqual([]);
    });
  });

  describe("upsertUser — regression (ADM-020, ADM-021)", () => {
    it("creates a new user (ADM-020)", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      const result = await service.upsertUser({
        id: "77777777-7777-4777-8777-777777777777",
        email: "newlead@customreport.local",
        name: "New Lead",
        role: "lead",
        reportingGroupId: GROUP_ID,
      });

      expect(result.users).toHaveLength(2);
      expect(
        result.users.find((u) => u.email === "newlead@customreport.local"),
      ).toBeDefined();
    });

    it("updates existing user by ID (ADM-021)", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      // First add the user
      await service.upsertUser({
        id: leadSession.userId,
        email: leadSession.email,
        name: "Old Name",
        role: "lead",
        reportingGroupId: GROUP_ID,
      });

      // Update the same user by ID
      const result = await service.upsertUser({
        id: leadSession.userId,
        email: "updated@customreport.local",
        name: "Updated Name",
        role: "lead",
        reportingGroupId: GROUP_ID,
      });

      expect(result.users).toHaveLength(2); // not 3 — updated, not duplicated
      const updated = result.users.find((u) => u.id === leadSession.userId);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.email).toBe("updated@customreport.local");
    });

    it("sorts users by name after upsert", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      await service.upsertUser({
        id: "77777777-7777-4777-8777-777777777777",
        email: "a@test.com",
        name: "Alpha",
        role: "lead",
        reportingGroupId: GROUP_ID,
      });
      const result = await service.upsertUser({
        id: "88888888-8888-4888-8888-888888888888",
        email: "z@test.com",
        name: "Zulu",
        role: "lead",
        reportingGroupId: GROUP_ID,
      });

      const names = result.users.map((u) => u.name);
      expect(names).toEqual(
        [...names].sort((a, b) => a.localeCompare(b, "ru")),
      );
    });
  });

  describe("upsertProject — regression (ADM-030)", () => {
    it("creates a new project (ADM-030)", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      const result = await service.upsertProject({
        id: "44444444-4444-4444-8444-444444444444",
        name: "New Project",
        archived: false,
        leadId: headSession.userId,
        leadName: headSession.name,
      });

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]?.name).toBe("New Project");
    });

    it("updates existing project by ID", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      await service.upsertProject({
        id: "44444444-4444-4444-8444-444444444444",
        name: "Original",
        archived: false,
        leadId: headSession.userId,
        leadName: headSession.name,
      });

      const result = await service.upsertProject({
        id: "44444444-4444-4444-8444-444444444444",
        name: "Updated",
        archived: false,
        leadId: headSession.userId,
        leadName: headSession.name,
      });

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]?.name).toBe("Updated");
    });
  });

  describe("upsertReminderRule — regression (ADM-040)", () => {
    it("creates a new reminder rule with kind/fireAt/status fields (ADM-040)", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      const result = await service.upsertReminderRule({
        id: "66666666-6666-4666-8666-666666666666",
        reportId: "22222222-2222-4222-8222-222222222222",
        kind: "deadline",
        fireAt: new Date("2026-04-17T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        policyId: null,
      });

      expect(result.reminderRules).toHaveLength(1);
      const rule = expectDefined(result.reminderRules[0]);
      expect(rule.kind).toBe("deadline");
      expect(rule.fireAt).toBeInstanceOf(Date);
      expect(rule.status).toBe("active");
      expect(rule.timezone).toBe("Europe/Moscow");
      expect(rule.version).toBe(1);
    });

    it("updates existing reminder rule by ID", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      await service.upsertReminderRule({
        id: "66666666-6666-4666-8666-666666666666",
        reportId: "22222222-2222-4222-8222-222222222222",
        kind: "deadline",
        fireAt: new Date("2026-04-17T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        policyId: null,
      });

      const result = await service.upsertReminderRule({
        id: "66666666-6666-4666-8666-666666666666",
        reportId: "22222222-2222-4222-8222-222222222222",
        kind: "deadline",
        fireAt: new Date("2026-04-18T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "paused",
        version: 2,
        policyId: null,
      });

      expect(result.reminderRules).toHaveLength(1);
      expect(result.reminderRules[0]?.status).toBe("paused");
      expect(result.reminderRules[0]?.version).toBe(2);
    });
  });

  describe("upsertPeriod — regression", () => {
    it("creates a new period", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      const result = await service.upsertPeriod({
        id: "55555555-5555-4555-8555-555555555555",
        periodStart: new Date("2026-04-13T00:00:00.000Z"),
        periodEnd: new Date("2026-04-19T23:59:59.000Z"),
        deadline: new Date("2026-04-17T15:00:00.000Z"),
        status: "draft",
      });

      expect(result.periods).toHaveLength(1);
      expect(result.periods[0]?.status).toBe("draft");
    });

    it("updates existing period by ID", async () => {
      const service = new AdminService(createRepository(initialSnapshot));

      await service.upsertPeriod({
        id: "55555555-5555-4555-8555-555555555555",
        periodStart: new Date("2026-04-13T00:00:00.000Z"),
        periodEnd: new Date("2026-04-19T23:59:59.000Z"),
        deadline: new Date("2026-04-17T15:00:00.000Z"),
        status: "draft",
      });

      const result = await service.upsertPeriod({
        id: "55555555-5555-4555-8555-555555555555",
        periodStart: new Date("2026-04-13T00:00:00.000Z"),
        periodEnd: new Date("2026-04-19T23:59:59.000Z"),
        deadline: new Date("2026-04-17T15:00:00.000Z"),
        status: "published",
      });

      expect(result.periods).toHaveLength(1);
    });
  });
});

describe("removeUser — DB deletion via repository", () => {
  it("removes the user from the snapshot users list", async () => {
    const snapshotWithLead: AdminSnapshot = {
      ...initialSnapshot,
      users: [
        ...initialSnapshot.users,
        {
          id: leadSession.userId,
          email: leadSession.email,
          name: leadSession.name,
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
        },
      ],
    };
    const service = new AdminService(createRepository(snapshotWithLead));
    const result = await service.removeUser(leadSession.userId);

    // Verify the user was removed from the snapshot
    expect(result.users).toHaveLength(1);
    expect(
      result.users.find((u) => u.id === leadSession.userId),
    ).toBeUndefined();
  });

  it("preserves other users when one is removed", async () => {
    const snapshotWithMultipleUsers: AdminSnapshot = {
      ...initialSnapshot,
      users: [
        ...initialSnapshot.users,
        {
          id: leadSession.userId,
          email: leadSession.email,
          name: leadSession.name,
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          email: "lead2@customreport.local",
          name: "Lead 2",
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
        },
      ],
    };
    const service = new AdminService(
      createRepository(snapshotWithMultipleUsers),
    );
    const result = await service.removeUser(leadSession.userId);

    expect(result.users).toHaveLength(2);
    expect(
      result.users.find((u) => u.id === leadSession.userId),
    ).toBeUndefined();
    expect(
      result.users.find((u) => u.email === "lead2@customreport.local"),
    ).toBeDefined();
  });

  it("handles removal of non-existent user gracefully (no-op)", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const result = await service.removeUser(
      "99999999-9999-4999-8999-999999999999",
    );

    // User didn't exist, so snapshot remains unchanged
    expect(result.users).toHaveLength(1);
  });
});

describe("removeProject — archive behavior", () => {
  it("archives the project instead of deleting it", async () => {
    const snapshotWithProject: AdminSnapshot = {
      ...initialSnapshot,
      projects: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Project 1",
          archived: false,
          leadId: headSession.userId,
          leadName: headSession.name,
        },
      ],
    };
    const service = new AdminService(createRepository(snapshotWithProject));
    const result = await service.removeProject(
      "44444444-4444-4444-8444-444444444444",
    );

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.archived).toBe(true);
  });
});

describe("removeReminderRule — deletion", () => {
  it("removes the reminder rule from the snapshot", async () => {
    const snapshotWithRule: AdminSnapshot = {
      ...initialSnapshot,
      reminderRules: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          reportId: "22222222-2222-4222-8222-222222222222",
          kind: "deadline",
          fireAt: new Date("2026-04-17T09:00:00.000Z"),
          timezone: "Europe/Moscow",
          status: "active",
          version: 1,
          policyId: null,
        },
      ],
    };
    const service = new AdminService(createRepository(snapshotWithRule));
    const result = await service.removeReminderRule(
      "66666666-6666-4666-8666-666666666666",
    );

    expect(result.reminderRules).toHaveLength(0);
  });
});

describe("adminRouter", () => {
  it("returns the admin snapshot for head users", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    await expect(
      adminRouter.getSnapshot({ adminService: service, session: headSession }),
    ).resolves.toMatchObject({ users: [{ role: "head" }] });
  });
});

// ---------------------------------------------------------------------------
// getSettings / updateSettings (API-11)
// ---------------------------------------------------------------------------

describe("AdminService — settings", () => {
  it("returns default settings", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const result = await service.getSettings();

    expect(result).toEqual(defaultSettings);
  });

  // UFB-048 (Phase 48-B): the 9 new fields round-trip through partial update.
  it("UFB-048: round-trips the 9 new AppSettings fields", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const result = await service.updateSettings({
      periodLengthDays: 14,
      workingDays: "mon-sun",
      gracePeriodHours: 0,
      defaultTimezone: "Europe/Berlin",
      defaultReminderAudience: "head-of-late",
      notificationFromEmail: "noreply@example.com",
      allowLateSubmissions: false,
      autoPublishAfterDeadline: true,
      autoArchiveWeeksAfterPublish: 4,
    });

    expect(result.periodLengthDays).toBe(14);
    expect(result.workingDays).toBe("mon-sun");
    expect(result.gracePeriodHours).toBe(0);
    expect(result.defaultTimezone).toBe("Europe/Berlin");
    expect(result.defaultReminderAudience).toBe("head-of-late");
    expect(result.notificationFromEmail).toBe("noreply@example.com");
    expect(result.allowLateSubmissions).toBe(false);
    expect(result.autoPublishAfterDeadline).toBe(true);
    expect(result.autoArchiveWeeksAfterPublish).toBe(4);
  });

  it("updates settings fully", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const result = await service.updateSettings({
      autoCreatePeriods: true,
      defaultDeadlineDays: 7,
    });

    expect(result.autoCreatePeriods).toBe(true);
    expect(result.defaultDeadlineDays).toBe(7);
  });

  it("applies partial update preserving other fields", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    // First do a full update
    await service.updateSettings({
      autoCreatePeriods: true,
      defaultDeadlineDays: 10,
    });

    // Partial update only changes one field
    const result = await service.updateSettings({
      defaultDeadlineDays: 3,
    });

    expect(result.autoCreatePeriods).toBe(true);
    expect(result.defaultDeadlineDays).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// saveStageAssignment / deleteStageAssignment / listStageAssignments (API-12)
// ---------------------------------------------------------------------------

describe("AdminService — stage assignments", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const STAGE_ID = "22222222-2222-4222-8222-222222222222";
  const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

  it("creates a stage assignment and lists it", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const created = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(created.userId).toBe(USER_ID);
    expect(created.stageId).toBe(STAGE_ID);
    expect(created.projectId).toBe(PROJECT_ID);
    expect(created.id).toBeDefined();

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).id).toBe(created.id);
  });

  it("deletes a stage assignment", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

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

  it("updates the assignee for the same project stage", async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const first = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    const second = await service.saveStageAssignment({
      userId: "44444444-4444-4444-8444-444444444444",
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(second.id).toBe(first.id);
    expect(second.userId).toBe("44444444-4444-4444-8444-444444444444");

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
