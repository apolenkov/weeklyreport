import type { AdminSnapshot } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import {
  adminSession,
  buildAdminCaller,
  createRepository,
  defaultGroup,
  GROUP_ID,
  headSession,
  initialSnapshot,
  leadSession,
} from "./__tests__/focused-admin-harness.js";
import { ProjectAdminService } from "./project-admin.service.js";
import { ReminderAdminService as ProductionReminderAdminService } from "./reminder-admin.service.js";
import { SnapshotAdminService as ProductionSnapshotAdminService } from "./snapshot-admin.service.js";

class ReminderAdminService extends ProductionReminderAdminService {
  constructor(
    repository: ConstructorParameters<typeof ProductionReminderAdminService>[0],
  ) {
    super(repository, createNullLogger());
  }
}

class SnapshotAdminService extends ProductionSnapshotAdminService {
  constructor(
    repository: ConstructorParameters<typeof ProductionSnapshotAdminService>[0],
  ) {
    super(repository, createNullLogger());
  }
}

function createLoggerSpy(): AppLogger & { info: ReturnType<typeof vi.fn> } {
  const info = vi.fn();
  return { ...createNullLogger(), info };
}

describe("ReminderAdminService — success logging", () => {
  const policyId = "77777777-7777-4777-8777-777777777777";

  it("does not log a deleted policy when the repository rejects", async () => {
    const logger = createLoggerSpy();
    const repository = {
      ...createRepository(initialSnapshot),
      deleteReminderPolicy: vi.fn(() =>
        Promise.reject(new Error("delete failed")),
      ),
    };
    const service = new ProductionReminderAdminService(repository, logger);

    await expect(service.removePolicy(policyId)).rejects.toThrow(
      "delete failed",
    );

    expect(logger.info).not.toHaveBeenCalledWith("deleted reminder policy", {
      policyId,
    });
  });

  it("logs a deleted policy after the repository succeeds", async () => {
    const logger = createLoggerSpy();
    const repository = createRepository(initialSnapshot);
    const service = new ProductionReminderAdminService(repository, logger);

    await service.removePolicy(policyId);

    expect(repository.deleteReminderPolicy).toHaveBeenCalledWith(policyId);
    expect(logger.info).toHaveBeenCalledWith("deleted reminder policy", {
      policyId,
    });
  });
});

describe("focused admin services", () => {
  it("checks reminder-policy existence without listing policies", async () => {
    const policyId = "77777777-7777-4777-8777-777777777777";
    const repository = createRepository({
      ...initialSnapshot,
      policies: [
        {
          id: policyId,
          kind: "deadline",
          offsetMinutes: -1440,
          timezone: "Europe/Moscow",
          audience: "lead-with-draft",
          active: true,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validUntil: null,
        },
      ],
    });
    const service = new ReminderAdminService(repository);

    await expect(service.policyExists(policyId)).resolves.toBe(true);
    expect(repository.listReminderPolicies).not.toHaveBeenCalled();
  });

  it("adds and removes users", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    const withLead = await service.upsertUser(
      {
        email: leadSession.email,
        id: leadSession.userId,
        name: leadSession.name,
        lastName: "Lead",
        firstName: "1",
        middleName: null,
        position: null,
        role: "lead",
        reportingGroupId: GROUP_ID,
        isActive: true,
      },
      "admin-actor",
    );

    expect(withLead.users).toHaveLength(2);

    const withoutLead = await service.removeUser(
      leadSession.userId,
      "admin-actor",
    );

    expect(withoutLead.users).toHaveLength(1);
  });

  it("creates and archives reporting groups", async () => {
    const service = new ProjectAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );
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

  it("persists headUserId round-trip on upsertReportingGroup", async () => {
    const service = new ProjectAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );
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

  it("persists a project through its owning service", async () => {
    const repository = createRepository(initialSnapshot);
    const projectService = new ProjectAdminService(
      repository,
      createNullLogger(),
    );

    const withProject = await projectService.upsertProject({
      archived: false,
      id: "44444444-4444-4444-8444-444444444444",
      leadId: headSession.userId,
      leadName: headSession.name,
      name: "Project 1",
    });
    expect(withProject.projects).toHaveLength(1);
  });

  it("rejects non-admin access at the live procedure gate", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    // Both lead and head are non-admin: the panel is admin-only.
    await expect(
      buildAdminCaller(service, leadSession).admin.snapshot(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      buildAdminCaller(service, headSession).admin.snapshot(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  describe("getSnapshot — regression", () => {
    it("returns snapshot with all entity types", async () => {
      const fullSnapshot: AdminSnapshot = {
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
            weekLabel: null,
            status: "draft",
            periodState: "open",
            periodStatus: "open",
            archived: false,
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
            publishedSnapshot: null,
          },
        ],
        reminderRules: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            reportId: "55555555-5555-4555-8555-555555555555",
            kind: "deadline",
            fireAt: new Date("2026-04-16T15:00:00.000Z"),
            deadline: new Date("2026-04-17T15:00:00.000Z"),
            timezone: "Europe/Moscow",
            status: "active",
            version: 1,
            policyId: "77777777-7777-4777-8777-777777777777",
          },
        ],
        reminderExecutions: [],
        policies: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            kind: "deadline",
            offsetMinutes: -1440,
            timezone: "Europe/Moscow",
            audience: "lead-with-draft",
            active: true,
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
            validUntil: null,
          },
        ],
      };

      const service = new SnapshotAdminService(createRepository(fullSnapshot));
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

      const service = new SnapshotAdminService(createRepository(emptySnapshot));
      const result = await service.getSnapshot();

      expect(result.users).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.periods).toEqual([]);
      expect(result.reminderRules).toEqual([]);
    });
  });

  describe("upsertUser — regression", () => {
    it("creates a new user", async () => {
      const service = new SnapshotAdminService(
        createRepository(initialSnapshot),
      );

      const result = await service.upsertUser(
        {
          id: "77777777-7777-4777-8777-777777777777",
          email: "newlead@customreport.local",
          name: "New Lead",
          lastName: "New",
          firstName: "Lead",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          isActive: true,
        },
        "admin-actor",
      );

      expect(result.users).toHaveLength(2);
      expect(
        result.users.find((u) => u.email === "newlead@customreport.local"),
      ).toBeDefined();
    });

    it("updates existing user by ID", async () => {
      const service = new SnapshotAdminService(
        createRepository(initialSnapshot),
      );

      await service.upsertUser(
        {
          id: leadSession.userId,
          email: leadSession.email,
          name: "Old Name",
          lastName: "Old",
          firstName: "Name",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          isActive: true,
        },
        "admin-actor",
      );

      const result = await service.upsertUser(
        {
          id: leadSession.userId,
          email: "updated@customreport.local",
          name: "Updated Name",
          lastName: "Updated",
          firstName: "Name",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          isActive: true,
        },
        "admin-actor",
      );

      expect(result.users).toHaveLength(2); // not 3 — updated, not duplicated
      const updated = result.users.find((u) => u.id === leadSession.userId);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.email).toBe("updated@customreport.local");
    });

    it("sorts users by name after upsert", async () => {
      const service = new SnapshotAdminService(
        createRepository(initialSnapshot),
      );

      await service.upsertUser(
        {
          id: "77777777-7777-4777-8777-777777777777",
          email: "a@test.com",
          name: "Alpha",
          lastName: "Alpha",
          firstName: "Test",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          isActive: true,
        },
        "admin-actor",
      );
      const result = await service.upsertUser(
        {
          id: "88888888-8888-4888-8888-888888888888",
          email: "z@test.com",
          name: "Zulu",
          lastName: "Zulu",
          firstName: "Test",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          isActive: true,
        },
        "admin-actor",
      );

      expect(result.users.map((user) => user.name)).toEqual([
        "Alpha",
        "Department Head",
        "Zulu",
      ]);
    });
  });

  describe("upsertProject — regression", () => {
    it("creates a new project", async () => {
      const service = new ProjectAdminService(
        createRepository(initialSnapshot),
        createNullLogger(),
      );

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
      const service = new ProjectAdminService(
        createRepository(initialSnapshot),
        createNullLogger(),
      );

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
          lastName: "Lead",
          firstName: "1",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
          isActive: true,
        },
      ],
    };
    const service = new SnapshotAdminService(
      createRepository(snapshotWithLead),
    );
    const result = await service.removeUser(leadSession.userId, "admin-actor");

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
          lastName: "Lead",
          firstName: "1",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
          isActive: true,
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          email: "lead2@customreport.local",
          name: "Lead 2",
          lastName: "Lead",
          firstName: "2",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_ID,
          reportingGroupName: defaultGroup.name,
          isActive: true,
        },
      ],
    };
    const service = new SnapshotAdminService(
      createRepository(snapshotWithMultipleUsers),
    );
    const result = await service.removeUser(leadSession.userId, "admin-actor");

    expect(result.users).toHaveLength(2);
    expect(
      result.users.find((u) => u.id === leadSession.userId),
    ).toBeUndefined();
    expect(
      result.users.find((u) => u.email === "lead2@customreport.local"),
    ).toBeDefined();
  });

  it("handles removal of non-existent user gracefully (no-op)", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));
    const result = await service.removeUser(
      "99999999-9999-4999-8999-999999999999",
      "admin-actor",
    );

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
    const service = new ProjectAdminService(
      createRepository(snapshotWithProject),
      createNullLogger(),
    );
    const result = await service.removeProject(
      "44444444-4444-4444-8444-444444444444",
    );

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.archived).toBe(true);
  });
});

describe("admin.snapshot (live adminProcedure)", () => {
  it("returns the admin snapshot for admin users", async () => {
    const service = new SnapshotAdminService(createRepository(initialSnapshot));

    await expect(
      buildAdminCaller(service, adminSession).admin.snapshot(),
    ).resolves.toMatchObject({ users: [{ role: "head" }] });
  });
});
