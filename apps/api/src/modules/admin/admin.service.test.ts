import type {
  AdminSnapshot,
  AppSettings,
  StageAssignment,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { adminRouter } from "./admin.router";
import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  type AdminRepository,
  AdminService,
} from "./admin.service";

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

// UFB-048 (Phase 48-B): AppSettings expanded with 9 new knobs.
// UFB-047 / Phase 49-01: legacy `departmentName` field removed.
// UFB-051 (Phase 51-A): period-cycle knobs (firstDayOfWeek,
// deadlineDayOfWeek, deadlineTime, maxOpenPeriods,
// requireAllSectionsToPublish, allowReopenAfterPublish, reopenWindowHours)
// mirror the SQL defaults from `20260510215245_period_model_expansion`.
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
  firstDayOfWeek: 1,
  deadlineDayOfWeek: 5,
  deadlineTime: "18:00",
  maxOpenPeriods: 1,
  requireAllSectionsToPublish: true,
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
};

function createRepository(
  snapshot: AdminSnapshot,
  settings: AppSettings = defaultSettings,
): AdminRepository {
  let currentSnapshot = structuredClone(snapshot);
  let currentSettings = structuredClone(settings);
  const assignments = new Map<string, StageAssignment>();

  return {
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
      if (existingIndex >= 0) {
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
      isActive: true,
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
            isActive: true,
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
        isActive: true,
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
        isActive: true,
      });

      // Update the same user by ID
      const result = await service.upsertUser({
        id: leadSession.userId,
        email: "updated@customreport.local",
        name: "Updated Name",
        role: "lead",
        reportingGroupId: GROUP_ID,
        isActive: true,
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
        isActive: true,
      });
      const result = await service.upsertUser({
        id: "88888888-8888-4888-8888-888888888888",
        email: "z@test.com",
        name: "Zulu",
        role: "lead",
        reportingGroupId: GROUP_ID,
        isActive: true,
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
          isActive: true,
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
          isActive: true,
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          email: "lead2@customreport.local",
          name: "Lead 2",
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
          isActive: true,
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

// ---------------------------------------------------------------------------
// UFB-052 (Phase 51-B): listPeriodsByState + archivePeriod + unarchivePeriod
// ---------------------------------------------------------------------------

import type { PeriodRowFromRepo } from "./admin.service";

const PERIOD_ID_OPEN = "11111111-1111-4111-8111-111111111101";
const PERIOD_ID_PUBLISHED_FRESH = "11111111-1111-4111-8111-111111111102";
const PERIOD_ID_PUBLISHED_STALE = "11111111-1111-4111-8111-111111111103";
const PERIOD_ID_ARCHIVED = "11111111-1111-4111-8111-111111111104";

function periodFixture(
  id: string,
  state: PeriodRowFromRepo["periodState"],
  overrides: Partial<PeriodRowFromRepo> = {},
): PeriodRowFromRepo {
  return {
    id,
    periodStart: new Date("2026-05-04T00:00:00Z"),
    periodEnd: new Date("2026-05-10T23:59:59Z"),
    deadline: new Date("2026-05-09T18:00:00Z"),
    publishedAt: state === "published" ? new Date() : null,
    periodState: state,
    periodStatus:
      state === "published" || state === "archived" ? "published" : "open",
    archived: state === "archived",
    autoPublished: false,
    autoArchived: state === "archived",
    submittedCount: 0,
    totalCount: 6,
    weekLabel: null,
    ...overrides,
  };
}

import type { PeriodState, PeriodStatus } from "@customreport/shared";

function makePeriodAwareRepository(
  rows: PeriodRowFromRepo[],
  settings: AppSettings = defaultSettings,
): AdminRepository {
  const base = createRepository(initialSnapshot, settings);
  const store = rows.map((r) => ({ ...r }));
  return {
    ...base,
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async listPeriodsByState(filter) {
      return store
        .filter((r) => filter.states.includes(r.periodState))
        .slice(0, filter.limit)
        .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async archivePeriod(periodId) {
      const row = store.find((r) => r.id === periodId);
      if (!row) throw new Error("not found");
      row.archived = true;
      row.periodState = "archived";
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async unarchivePeriod(periodId): Promise<{
      nextPeriodState: PeriodState;
      nextPeriodStatus: PeriodStatus;
    }> {
      const row = store.find((r) => r.id === periodId);
      if (!row) throw new Error("not found");
      const next: PeriodState =
        row.periodStatus === "open" ? "open" : "published";
      row.archived = false;
      row.periodState = next;
      return { nextPeriodState: next, nextPeriodStatus: row.periodStatus };
    },
  };
}

describe("AdminService — listPeriodsByState (UFB-052)", () => {
  it("returns empty when repository does not implement the method", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    const result = await service.listPeriodsByState({ bucket: "active" });
    expect(result).toEqual([]);
  });

  it("active bucket fans out to scheduled+open+published", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published", {
      publishedAt: new Date(Date.now() - 2 * 3_600_000), // 2h ago
      periodStart: new Date("2026-05-04T00:00:00Z"),
    });
    const open = periodFixture(PERIOD_ID_OPEN, "open", {
      periodStart: new Date("2026-05-11T00:00:00Z"),
    });
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived");
    const service = new AdminService(
      makePeriodAwareRepository([fresh, open, archived]),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(PERIOD_ID_OPEN);
    expect(ids).toContain(PERIOD_ID_PUBLISHED_FRESH);
    expect(ids).not.toContain(PERIOD_ID_ARCHIVED);
  });

  it("archive bucket only contains archived rows", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published");
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived");
    const service = new AdminService(
      makePeriodAwareRepository([fresh, archived]),
    );

    const rows = await service.listPeriodsByState({ bucket: "archive" });
    expect(rows.map((r) => r.id)).toEqual([PERIOD_ID_ARCHIVED]);
  });

  it("canReopen is true for published rows within window", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published", {
      publishedAt: new Date(Date.now() - 2 * 3_600_000), // 2h ago
    });
    const service = new AdminService(
      makePeriodAwareRepository([fresh], {
        ...defaultSettings,
        allowReopenAfterPublish: true,
        reopenWindowHours: 72,
      }),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    const row = rows.find((r) => r.id === PERIOD_ID_PUBLISHED_FRESH);
    expect(row?.canReopen).toBe(true);
  });

  it("canReopen is false for published rows outside window", async () => {
    const stale = periodFixture(PERIOD_ID_PUBLISHED_STALE, "published", {
      publishedAt: new Date(Date.now() - 100 * 3_600_000), // 100h ago
    });
    const service = new AdminService(
      makePeriodAwareRepository([stale], {
        ...defaultSettings,
        allowReopenAfterPublish: true,
        reopenWindowHours: 72,
      }),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    expect(rows[0]?.canReopen).toBe(false);
  });

  it("canReopen is false when allowReopenAfterPublish=false (master switch)", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published", {
      publishedAt: new Date(Date.now() - 2 * 3_600_000),
    });
    const service = new AdminService(
      makePeriodAwareRepository([fresh], {
        ...defaultSettings,
        allowReopenAfterPublish: false,
        reopenWindowHours: 72,
      }),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    expect(rows[0]?.canReopen).toBe(false);
  });

  it("canArchive is true for published not-yet-archived rows", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published");
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived");
    const service = new AdminService(
      makePeriodAwareRepository([fresh, archived]),
    );
    const active = await service.listPeriodsByState({ bucket: "active" });
    expect(active[0]?.canArchive).toBe(true);
    const archive = await service.listPeriodsByState({ bucket: "archive" });
    expect(archive[0]?.canArchive).toBe(false);
  });

  it("limit is clamped between 1 and 200", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published");
    const service = new AdminService(makePeriodAwareRepository([fresh]));
    // Negative gets clamped to 1, then filtered (and the one row matches).
    const a = await service.listPeriodsByState({ bucket: "active", limit: 0 });
    expect(a.length).toBeGreaterThan(0);
    // 1000 gets clamped to 200, but no error.
    const b = await service.listPeriodsByState({
      bucket: "active",
      limit: 1000,
    });
    expect(b.length).toBeLessThanOrEqual(200);
  });
});

describe("AdminService — archivePeriod / unarchivePeriod (UFB-052)", () => {
  it("archivePeriod flips state + archived on the in-memory row", async () => {
    const open = periodFixture(PERIOD_ID_OPEN, "open");
    const repo = makePeriodAwareRepository([open]);
    const service = new AdminService(repo);

    const result = await service.archivePeriod(PERIOD_ID_OPEN);
    expect(result).toEqual({ success: true });

    const rows = await service.listPeriodsByState({ bucket: "archive" });
    expect(rows.map((r) => r.id)).toContain(PERIOD_ID_OPEN);
  });

  it("unarchivePeriod returns the derived nextPeriodState", async () => {
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived", {
      periodStatus: "published",
    });
    const service = new AdminService(makePeriodAwareRepository([archived]));

    const result = await service.unarchivePeriod(PERIOD_ID_ARCHIVED);
    expect(result.success).toBe(true);
    expect(result.periodState).toBe("published");
  });

  it("archivePeriod throws when repository does not implement the method", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    await expect(service.archivePeriod(PERIOD_ID_OPEN)).rejects.toThrow(
      /not implemented/,
    );
  });
});

// ---------------------------------------------------------------------------
// UFB-054 (Phase 56-B): Group ↔ Product M:M surface
// ---------------------------------------------------------------------------

describe("AdminService — Group ↔ Product M:M (UFB-054)", () => {
  const GROUP_A = "11111111-1111-4111-8111-111111111aaa";
  const GROUP_B = "11111111-1111-4111-8111-111111111bbb";
  const PRODUCT_X = "22222222-2222-4222-8222-2222222222a1";

  function makeRepoWithGroupProductSurface(
    snapshot: AdminSnapshot,
  ): AdminRepository {
    const base = createRepository(snapshot);
    // B1 invariant: keyed by productId alone — one product, one group.
    const edges = new Map<
      string,
      { id: string; groupId: string; createdAt: Date }
    >();
    return {
      ...base,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
      async attachProductToGroup({ groupId, productId }) {
        const existing = edges.get(productId);
        if (existing) {
          if (existing.groupId === groupId) {
            // Idempotent: same group, return canonical row.
            return {
              id: existing.id,
              groupId,
              productId,
              createdAt: existing.createdAt,
            };
          }
          const currentGroup = snapshot.groups.find(
            (g) => g.id === existing.groupId,
          );
          throw new Error(
            `Product is already attached to ${currentGroup?.name ?? "another group"}. Detach it there before attaching it to another group.`,
          );
        }
        const row = {
          id: crypto.randomUUID(),
          groupId,
          productId,
          createdAt: new Date("2026-05-11T00:00:00.000Z"),
        };
        edges.set(productId, { id: row.id, groupId, createdAt: row.createdAt });
        return row;
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
      async detachProductFromGroup({ productId }) {
        edges.delete(productId);
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
      async listGroupProducts(groupId) {
        const productIds = [...edges.entries()]
          .filter(([, v]) => v.groupId === groupId)
          .map(([pid]) => pid);
        return productIds.length > 0
          ? snapshot.projects.filter((p) => productIds.includes(p.id))
          : [];
      },
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
      async listProductGroups(productId) {
        const entry = edges.get(productId);
        if (!entry) return [];
        return [
          expectDefined(snapshot.groups.find((g) => g.id === entry.groupId)),
        ];
      },
    };
  }

  const snapshot: AdminSnapshot = {
    ...initialSnapshot,
    groups: [
      defaultGroup,
      {
        id: GROUP_A,
        name: "Platform",
        description: null,
        archived: false,
      },
      {
        id: GROUP_B,
        name: "Integrations",
        description: null,
        archived: false,
      },
    ],
    projects: [
      {
        id: PRODUCT_X,
        name: "Платформа интеграций",
        archived: false,
        leadId: headSession.userId,
        leadName: headSession.name,
      },
    ],
  };

  it("attachProductToGroup returns a parsed GroupProduct row", async () => {
    const service = new AdminService(makeRepoWithGroupProductSurface(snapshot));
    const row = await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    expect(row.groupId).toBe(GROUP_A);
    expect(row.productId).toBe(PRODUCT_X);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("attachProductToGroup is idempotent when same group is re-attached (B1)", async () => {
    const service = new AdminService(makeRepoWithGroupProductSurface(snapshot));
    const first = await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    const second = await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    expect(second.id).toBe(first.id);
  });

  it("attachProductToGroup rejects attaching a product owned by another group (B1 invariant)", async () => {
    const service = new AdminService(makeRepoWithGroupProductSurface(snapshot));
    await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });

    await expect(
      service.attachProductToGroup({
        groupId: GROUP_B,
        productId: PRODUCT_X,
      }),
    ).rejects.toThrow(/already attached to Platform/);

    const groups = await service.listProductGroups(PRODUCT_X);
    expect(groups.map((g) => g.id)).toEqual([GROUP_A]);

    const groupAProducts = await service.listGroupProducts(GROUP_A);
    expect(groupAProducts.map((p) => p.id)).toContain(PRODUCT_X);
  });

  it("detachProductFromGroup returns {success: true} and removes the edge", async () => {
    const service = new AdminService(makeRepoWithGroupProductSurface(snapshot));
    await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    const result = await service.detachProductFromGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    expect(result).toEqual({ success: true });
    const groups = await service.listProductGroups(PRODUCT_X);
    expect(groups).toEqual([]);
  });

  it("detachProductFromGroup is idempotent (no-op when edge already absent)", async () => {
    const service = new AdminService(makeRepoWithGroupProductSurface(snapshot));
    await expect(
      service.detachProductFromGroup({
        groupId: GROUP_A,
        productId: PRODUCT_X,
      }),
    ).resolves.toEqual({ success: true });
  });

  it("listGroupProducts and listProductGroups reflect attached edge (B1: one group per product)", async () => {
    const service = new AdminService(makeRepoWithGroupProductSurface(snapshot));
    await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });

    const groupsForProduct = await service.listProductGroups(PRODUCT_X);
    expect(groupsForProduct.map((g) => g.id)).toEqual([GROUP_A]);

    const productsForGroupA = await service.listGroupProducts(GROUP_A);
    expect(productsForGroupA.map((p) => p.id)).toContain(PRODUCT_X);
  });

  it("returns empty arrays when repository does not implement the surface", async () => {
    const service = new AdminService(createRepository(snapshot));
    expect(await service.listGroupProducts(GROUP_A)).toEqual([]);
    expect(await service.listProductGroups(PRODUCT_X)).toEqual([]);
  });

  it("attach/detach throw when repository does not implement the method", async () => {
    const service = new AdminService(createRepository(snapshot));
    await expect(
      service.attachProductToGroup({
        groupId: GROUP_A,
        productId: PRODUCT_X,
      }),
    ).rejects.toThrow(/not implemented/);
    await expect(
      service.detachProductFromGroup({
        groupId: GROUP_A,
        productId: PRODUCT_X,
      }),
    ).rejects.toThrow(/not implemented/);
  });
});

// ---------------------------------------------------------------------------
// UFB-063: createPeriodManual — admin escape hatch
// ---------------------------------------------------------------------------

function makeCreatePeriodRepository(opts: {
  /** Pre-seeded periods used by the overlap gate. */
  seedPeriods?: { id: string; periodStart: Date; periodEnd: Date }[];
  /** Settings to override; falls back to defaultSettings. */
  settings?: AppSettings;
}): AdminRepository & {
  // Test-only inspector for the row the service asked the repo to mint.
  readLastCreated(): {
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: string;
  } | null;
} {
  const base = createRepository(
    initialSnapshot,
    opts.settings ?? defaultSettings,
  );
  const seed = [...(opts.seedPeriods ?? [])];
  let lastCreated: ReturnType<
    ReturnType<typeof makeCreatePeriodRepository>["readLastCreated"]
  > = null;
  let counter = 0;
  return {
    ...base,
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async findOverlappingPeriod(input) {
      // Half-open intersect: existingStart <= newEnd && existingEnd >= newStart.
      const hit = seed
        .filter(
          (p) =>
            p.periodStart.getTime() <= input.periodEnd.getTime() &&
            p.periodEnd.getTime() >= input.periodStart.getTime(),
        )
        .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
        .at(0);
      return hit
        ? {
            id: hit.id,
            periodStart: hit.periodStart,
            periodEnd: hit.periodEnd,
          }
        : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async createPeriodManual(input) {
      counter += 1;
      const id = `11111111-1111-4111-8111-1111111110${String(counter).padStart(
        2,
        "0",
      )}`;
      lastCreated = {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        weekLabel: input.weekLabel,
        periodState: input.periodState,
      };
      seed.push({
        id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      });
      return {
        id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        periodState: input.periodState,
      };
    },
    readLastCreated() {
      return lastCreated;
    },
  };
}

describe("AdminService — createPeriodManual (UFB-063)", () => {
  it("happy path: mints a period with the supplied non-Monday periodStart", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new AdminService(repo);

    const result = await service.createPeriodManual(
      {
        periodStart: new Date("2026-05-20T00:00:00.000Z"),
      },
      // Pin `now` to BEFORE periodStart so the initial state is
      // deterministic ('scheduled').
      { now: new Date("2026-05-11T12:00:00.000Z") },
    );

    expect(result.periodId).toMatch(/^[0-9a-f-]+$/);
    expect(result.periodStart.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    // periodEnd defaults to start + (periodLengthDays - 1) days + 23:59:59.999
    // for the configured 7-day periodLength.
    expect(result.periodEnd.toISOString()).toBe("2026-05-26T23:59:59.999Z");
    // Initial state derives from now-vs-start; periodStart is in the
    // future → 'scheduled'.
    expect(result.periodState).toBe("scheduled");
  });

  it("derives 'open' when periodStart is at or before now", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new AdminService(repo);

    const result = await service.createPeriodManual(
      {
        periodStart: new Date("2026-05-04T00:00:00.000Z"),
      },
      { now: new Date("2026-05-11T12:00:00.000Z") },
    );
    expect(result.periodState).toBe("open");
  });

  it("D-8: accepts a custom period that starts on a non-Monday", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new AdminService(repo);

    const result = await service.createPeriodManual(
      {
        periodStart: new Date("2026-05-19T00:00:00.000Z"),
      },
      { now: new Date("2026-05-11T12:00:00.000Z") },
    );

    expect(result.periodStart.toISOString()).toBe("2026-05-19T00:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-05-25T23:59:59.999Z");

    const last = repo.readLastCreated();
    expect(last?.periodStart.toISOString()).toBe("2026-05-19T00:00:00.000Z");
  });

  it("computes default deadline from AppSettings (defaultDeadlineDays + workingDays + deadlineTime)", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new AdminService(repo);

    // defaultSettings: defaultDeadlineDays=5, workingDays='mon-fri',
    // defaultTimezone='Europe/Moscow', deadlineTime='18:00'. periodStart
    // is Monday 2026-05-04 00:00 UTC; +5 business days (mon→tue→wed→thu→fri→mon)
    // lands on Monday 2026-05-11; 18:00 Europe/Moscow == 15:00 UTC. The
    // `+5 business days` shape matches the scheduler's own date math
    // (verified against `computeDeadline` in business-date.ts).
    await service.createPeriodManual({
      periodStart: new Date("2026-05-04T00:00:00.000Z"),
    });

    const last = repo.readLastCreated();
    expect(last).not.toBeNull();
    expect(last?.deadline.toISOString()).toBe("2026-05-11T15:00:00.000Z");
  });

  it("respects explicit periodEnd / deadline / weekLabel overrides", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new AdminService(repo);

    const explicitEnd = new Date("2026-05-31T23:59:59.999Z");
    const explicitDeadline = new Date("2026-05-29T15:00:00.000Z");
    await service.createPeriodManual({
      periodStart: new Date("2026-05-25T00:00:00.000Z"),
      periodEnd: explicitEnd,
      deadline: explicitDeadline,
      weekLabel: "Sprint 12 catch-up",
    });

    const last = repo.readLastCreated();
    expect(last?.periodEnd.toISOString()).toBe(explicitEnd.toISOString());
    expect(last?.deadline.toISOString()).toBe(explicitDeadline.toISOString());
    expect(last?.weekLabel).toBe("Sprint 12 catch-up");
  });

  it("rejects when [periodStart, periodEnd] overlaps an existing period", async () => {
    const repo = makeCreatePeriodRepository({
      seedPeriods: [
        {
          id: "existing",
          periodStart: new Date("2026-05-04T00:00:00.000Z"),
          periodEnd: new Date("2026-05-10T23:59:59.999Z"),
        },
      ],
    });
    const service = new AdminService(repo);

    await expect(
      service.createPeriodManual({
        // Starts inside the existing period → overlap.
        periodStart: new Date("2026-05-08T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("rejects when periodEnd < periodStart", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new AdminService(repo);

    await expect(
      service.createPeriodManual({
        periodStart: new Date("2026-05-18T00:00:00.000Z"),
        periodEnd: new Date("2026-05-10T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("throws when repository does not implement createPeriodManual", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    await expect(
      service.createPeriodManual({
        periodStart: new Date("2026-05-18T00:00:00.000Z"),
      }),
    ).rejects.toThrow(/not implemented/);
  });
});

// ---------------------------------------------------------------------------
// UFB-067: updatePeriodManual — admin escape hatch for in-place edits
// ---------------------------------------------------------------------------

interface EditableRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  weekLabel: string | null;
  periodState: "scheduled" | "open" | "published" | "archived";
}

function makeUpdatePeriodRepository(opts: {
  /** Pre-seeded periods used by both the read + overlap paths. */
  seedPeriods: EditableRow[];
  settings?: AppSettings;
}): AdminRepository & {
  readLastUpdated(): {
    reportId: string;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date;
      weekLabel?: string | null;
    };
  } | null;
} {
  const base = createRepository(
    initialSnapshot,
    opts.settings ?? defaultSettings,
  );
  const rows = new Map<string, EditableRow>(
    opts.seedPeriods.map((row) => [row.id, { ...row }]),
  );
  let lastUpdated: ReturnType<
    ReturnType<typeof makeUpdatePeriodRepository>["readLastUpdated"]
  > = null;
  return {
    ...base,
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async findOverlappingPeriod(input) {
      // Half-open intersect + optional self-exclusion (UFB-067).
      const hit = [...rows.values()]
        .filter((row) => (input.excludeId ? row.id !== input.excludeId : true))
        .filter(
          (row) =>
            row.periodStart.getTime() <= input.periodEnd.getTime() &&
            row.periodEnd.getTime() >= input.periodStart.getTime(),
        )
        .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
        .at(0);
      return hit
        ? {
            id: hit.id,
            periodStart: hit.periodStart,
            periodEnd: hit.periodEnd,
          }
        : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async readPeriodById(periodId) {
      const row = rows.get(periodId);
      return row ? { ...row } : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async repository contract (no awaitable work in the stub)
    async updatePeriodManual(input) {
      const row = rows.get(input.reportId);
      if (!row) {
        throw new Error("test repo: row not found");
      }
      const next: EditableRow = {
        ...row,
        ...(input.data.periodStart !== undefined
          ? { periodStart: input.data.periodStart }
          : {}),
        ...(input.data.periodEnd !== undefined
          ? { periodEnd: input.data.periodEnd }
          : {}),
        ...(input.data.deadline !== undefined
          ? { deadline: input.data.deadline }
          : {}),
        ...(input.data.weekLabel !== undefined
          ? { weekLabel: input.data.weekLabel }
          : {}),
      };
      rows.set(input.reportId, next);
      lastUpdated = { reportId: input.reportId, data: input.data };
      return { ...next };
    },
    readLastUpdated() {
      return lastUpdated;
    },
  };
}

const SEED_ROW_ID = "55555555-5555-4555-8555-555555555501";
const SEED_OTHER_ID = "55555555-5555-4555-8555-555555555502";

function defaultEditSeed(): EditableRow[] {
  return [
    {
      id: SEED_ROW_ID,
      periodStart: new Date("2026-05-04T00:00:00.000Z"),
      periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      deadline: new Date("2026-05-09T15:00:00.000Z"),
      weekLabel: "Sprint 11",
      periodState: "open",
    },
  ];
}

describe("AdminService — updatePeriodManual (UFB-067)", () => {
  it("happy path: applies the diff and returns the updated row", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new AdminService(repo);

    const { result, diff } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      deadline: new Date("2026-05-10T15:00:00.000Z"),
      weekLabel: "Sprint 11 (extended)",
    });

    expect(result.periodId).toBe(SEED_ROW_ID);
    expect(result.deadline.toISOString()).toBe("2026-05-10T15:00:00.000Z");
    expect(result.weekLabel).toBe("Sprint 11 (extended)");
    // Diff carries only the two changed fields.
    expect(Object.keys(diff).sort()).toEqual(["deadline", "weekLabel"]);
    expect(diff.deadline?.from.toISOString()).toBe("2026-05-09T15:00:00.000Z");
    expect(diff.weekLabel?.from).toBe("Sprint 11");
    // Repository write only carries the changed keys.
    const last = repo.readLastUpdated();
    expect(last?.reportId).toBe(SEED_ROW_ID);
    expect(Object.keys(last?.data ?? {}).sort()).toEqual([
      "deadline",
      "weekLabel",
    ]);
  });

  it("allows clearing weekLabel via explicit null", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new AdminService(repo);

    const { result, diff } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      weekLabel: null,
    });

    expect(result.weekLabel).toBeNull();
    expect(diff.weekLabel).toEqual({ from: "Sprint 11", to: null });
  });

  it("rejects when reportId does not resolve", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new AdminService(repo);

    await expect(
      service.updatePeriodManual({
        reportId: "00000000-0000-4000-8000-000000000000",
        deadline: new Date("2026-05-10T15:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodNotFoundError);
  });

  it("rejects when shifted envelope overlaps a DIFFERENT existing period", async () => {
    const repo = makeUpdatePeriodRepository({
      seedPeriods: [
        ...defaultEditSeed(),
        {
          id: SEED_OTHER_ID,
          periodStart: new Date("2026-05-11T00:00:00.000Z"),
          periodEnd: new Date("2026-05-17T23:59:59.999Z"),
          deadline: new Date("2026-05-16T15:00:00.000Z"),
          weekLabel: "Sprint 12",
          periodState: "scheduled",
        },
      ],
    });
    const service = new AdminService(repo);

    // Try to push SEED_ROW_ID's end into the SEED_OTHER_ID window.
    await expect(
      service.updatePeriodManual({
        reportId: SEED_ROW_ID,
        periodEnd: new Date("2026-05-12T23:59:59.999Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("self-edit on the same envelope does NOT trigger overlap (excludeId works)", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new AdminService(repo);

    // Shifting deadline only — envelope keys unchanged — should not even
    // touch the overlap gate. Then shift periodEnd to the same value
    // (a no-op for periodEnd, change deadline) → still safe.
    const { result } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      periodEnd: new Date("2026-05-10T23:59:59.999Z"), // same as seed
      deadline: new Date("2026-05-10T15:00:00.000Z"),
    });
    expect(result.deadline.toISOString()).toBe("2026-05-10T15:00:00.000Z");
  });

  it("no-op (zero changed fields) short-circuits without audit / write", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new AdminService(repo);

    const { result, diff } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      // All values match the seed.
      periodStart: new Date("2026-05-04T00:00:00.000Z"),
      periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      deadline: new Date("2026-05-09T15:00:00.000Z"),
      weekLabel: "Sprint 11",
    });

    expect(diff).toEqual({});
    expect(result.periodId).toBe(SEED_ROW_ID);
    // Repository write skipped entirely.
    expect(repo.readLastUpdated()).toBeNull();
  });

  it("rejects when supplied periodEnd < periodStart", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new AdminService(repo);

    await expect(
      service.updatePeriodManual({
        reportId: SEED_ROW_ID,
        periodStart: new Date("2026-05-20T00:00:00.000Z"),
        periodEnd: new Date("2026-05-19T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("throws when repository does not implement updatePeriodManual", async () => {
    const service = new AdminService(createRepository(initialSnapshot));
    await expect(
      service.updatePeriodManual({
        reportId: SEED_ROW_ID,
        deadline: new Date("2026-05-10T15:00:00.000Z"),
      }),
    ).rejects.toThrow(/not implemented/);
  });
});
