import type { AdminSnapshot } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
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

    const withLead = await service.upsertUser({
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
    });

    expect(withLead.users).toHaveLength(2);

    const withoutLead = await service.removeUser(leadSession.userId);

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

  it("routes project and reminder writes to their owning services", async () => {
    const repository = createRepository(initialSnapshot);
    const projectService = new ProjectAdminService(
      repository,
      createNullLogger(),
    );
    const reminderService = new ReminderAdminService(repository);

    const withProject = await projectService.upsertProject({
      archived: false,
      id: "44444444-4444-4444-8444-444444444444",
      leadId: leadSession.userId,
      leadName: leadSession.name,
      name: "Project 1",
    });
    const withRule = await reminderService.upsertReminderRule({
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
    expect(withRule.reminderRules).toHaveLength(1);
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
            status: "draft",
            periodState: "open",
            periodStatus: "open",
            archived: false,
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
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

      const result = await service.upsertUser({
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
      });

      expect(result.users).toHaveLength(2);
      expect(
        result.users.find((u) => u.email === "newlead@customreport.local"),
      ).toBeDefined();
    });

    it("updates existing user by ID", async () => {
      const service = new SnapshotAdminService(
        createRepository(initialSnapshot),
      );

      await service.upsertUser({
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
      });

      const result = await service.upsertUser({
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
      });

      expect(result.users).toHaveLength(2); // not 3 — updated, not duplicated
      const updated = result.users.find((u) => u.id === leadSession.userId);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.email).toBe("updated@customreport.local");
    });

    it("sorts users by name after upsert", async () => {
      const service = new SnapshotAdminService(
        createRepository(initialSnapshot),
      );

      await service.upsertUser({
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
      });
      const result = await service.upsertUser({
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
      });

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

  describe("upsertReminderRule — regression", () => {
    it("creates a new reminder rule with kind/fireAt/status fields", async () => {
      const service = new ReminderAdminService(
        createRepository(initialSnapshot),
      );

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
      const service = new ReminderAdminService(
        createRepository(initialSnapshot),
      );

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
    const result = await service.removeUser(leadSession.userId);

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
    const service = new SnapshotAdminService(createRepository(initialSnapshot));
    const result = await service.removeUser(
      "99999999-9999-4999-8999-999999999999",
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
    const service = new ReminderAdminService(
      createRepository(snapshotWithRule),
    );
    const result = await service.removeReminderRule(
      "66666666-6666-4666-8666-666666666666",
    );

    expect(result.reminderRules).toHaveLength(0);
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
