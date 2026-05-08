import { describe, expect, it } from "vitest";

import {
  adminSnapshotSchema,
  appSettingsSchema,
  type AdminSnapshot,
  type AppSettings,
} from "@customreport/shared";

import { mapAdminSnapshot, mapAdminSettings, __testing } from "./admin";
import { expectDefined } from "../../test/expect-defined.js";

const { mapReminder } = __testing;

// Valid v4-shape UUIDs (variant 8/9/a/b in 19th hex char, version 4 in 13th).
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";
const UUID_GROUP = "55555555-5555-4555-8555-555555555555";

function makeSnapshot(overrides: Partial<AdminSnapshot> = {}): AdminSnapshot {
  return adminSnapshotSchema.parse({
    groups: overrides.groups ?? [
      {
        id: UUID_GROUP,
        name: "Core Development",
        description: "Default group",
        archived: false,
      },
    ],
    users: overrides.users ?? [
      {
        id: UUID_A,
        email: "lead@x.io",
        name: "Lead Person",
        role: "lead",
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Core Development",
      },
      {
        id: UUID_B,
        email: "head@x.io",
        name: "Head Person",
        role: "head",
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Core Development",
      },
      {
        id: UUID_C,
        email: "view@x.io",
        name: "Viewer Person",
        role: "viewer",
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Core Development",
      },
    ],
    projects: overrides.projects ?? [
      {
        id: UUID_A,
        name: "CRM Portal",
        archived: false,
        leadId: UUID_A,
        leadName: "Lead Person",
      },
      {
        id: UUID_B,
        name: "Legacy Tool",
        archived: true,
        leadId: UUID_A,
        leadName: "Lead Person",
      },
    ],
    periods: overrides.periods ?? [
      {
        id: UUID_A,
        periodStart: "2026-04-13T00:00:00.000Z",
        periodEnd: "2026-04-19T23:59:59.000Z",
        deadline: "2026-04-18T18:00:00.000Z",
        status: "published",
      },
      {
        id: UUID_B,
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-26T23:59:59.000Z",
        deadline: "2026-04-25T18:00:00.000Z",
        status: "draft",
      },
    ],
    reminderRules: overrides.reminderRules ?? [
      {
        id: UUID_A,
        reportId: null,
        kind: "deadline",
        fireAt: "2026-04-25T15:00:00.000Z",
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
      },
      {
        id: UUID_B,
        reportId: null,
        kind: "follow_up",
        fireAt: "2026-04-26T15:00:00.000Z",
        timezone: "Europe/Moscow",
        status: "paused",
        version: 1,
      },
    ],
    reminderExecutions: overrides.reminderExecutions ?? [],
  });
}

describe("mapAdminSnapshot", () => {
  it("returns empty arrays for an empty snapshot, never undefined", () => {
    const empty = adminSnapshotSchema.parse({
      users: [],
      groups: [],
      projects: [],
      periods: [],
      reminderRules: [],
      reminderExecutions: [],
    });
    const mapped = mapAdminSnapshot(empty);
    expect(mapped.users).toEqual([]);
    expect(mapped.groups).toEqual([]);
    expect(mapped.products).toEqual([]);
    expect(mapped.periods).toEqual([]);
    expect(mapped.reminders).toEqual([]);
  });

  it("maps users preserving role enum and group display", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    const lead = mapped.users.find((u) => u.id === UUID_A);
    const head = mapped.users.find((u) => u.id === UUID_B);
    const viewer = mapped.users.find((u) => u.id === UUID_C);
    expect(lead?.role).toBe("lead");
    expect(head?.role).toBe("head");
    expect(viewer?.role).toBe("viewer");
    expect(lead?.groupId).toBe(UUID_GROUP);
    expect(lead?.department).toBe("Core Development");
  });

  it("translates project archived flag to mock status", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    const active = mapped.products.find((p) => p.id === UUID_A);
    const archived = mapped.products.find((p) => p.id === UUID_B);
    expect(active?.status).toBe("active");
    expect(archived?.status).toBe("archived");
  });

  it("synthesizes a 7-stage empty assignment grid for every product", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    for (const product of mapped.products) {
      expect(product.stages).toHaveLength(7);
      for (const stage of product.stages) {
        expect(stage.assigneeId).toBeNull();
      }
      const stageNames = product.stages.map((s) => s.stage);
      expect(stageNames).toEqual([
        "Planning",
        "Analysis",
        "Design",
        "Development",
        "Testing",
        "DevOps",
        "Support",
      ]);
    }
  });

  it("maps period status: published passthrough, 'draft' -> 'open'", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    const published = mapped.periods.find((p) => p.id === UUID_A);
    const draft = mapped.periods.find((p) => p.id === UUID_B);
    expect(published?.status).toBe("published");
    expect(draft?.status).toBe("open");
  });

  it("synthesizes weekLabel and ISO date strings from period dates", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    const period = mapped.periods.find((p) => p.id === UUID_A);
    expect(period?.weekLabel).toMatch(/^Week \d{1,2}$/);
    expect(period?.startDate).toBe("2026-04-13");
    expect(period?.endDate).toBe("2026-04-19");
    expect(period?.deadline).toBe("2026-04-18");
  });

  it("maps reminder status active->true, paused->false (PITFALLS Pitfall 1)", () => {
    const snapshot = makeSnapshot();
    const active = mapReminder(expectDefined(snapshot.reminderRules[0]));
    const paused = mapReminder(expectDefined(snapshot.reminderRules[1]));
    expect(active.active).toBe(true);
    expect(paused.active).toBe(false);
  });

  it("synthesizes reminder name and description (API has no name/description)", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    expect(mapped.reminders).toHaveLength(2);
    for (const reminder of mapped.reminders) {
      expect(reminder.name.length).toBeGreaterThan(0);
      expect(reminder.description.length).toBeGreaterThan(0);
    }
    // Different kinds yield different names.
    const names = new Set(mapped.reminders.map((r) => r.name));
    expect(names.size).toBe(2);
  });

  it("preserves user IDs and emails exactly (no transformation)", () => {
    const snapshot = makeSnapshot({
      users: [
        {
          id: UUID_D,
          email: "preserved@example.com",
          name: "Stable Lead",
          role: "lead",
          reportingGroupId: UUID_GROUP,
          reportingGroupName: "Core Development",
        },
      ],
    });
    const mapped = mapAdminSnapshot(snapshot);
    expect(mapped.users[0]?.id).toBe(UUID_D);
    expect(mapped.users[0]?.email).toBe("preserved@example.com");
    expect(mapped.users[0]?.name).toBe("Stable Lead");
  });
});

describe("mapAdminSettings", () => {
  it("copies all configured fields from appSettingsSchema", () => {
    const api: AppSettings = appSettingsSchema.parse({
      departmentName: "Core Development",
      autoCreatePeriods: true,
      defaultDeadlineDays: 5,
    });
    const mapped = mapAdminSettings(api);
    expect(mapped.departmentName).toBe("Core Development");
    expect(mapped.autoCreatePeriods).toBe(true);
    expect(mapped.defaultDeadlineDays).toBe(5);
  });

  it("round-trips a non-default configuration", () => {
    const api: AppSettings = appSettingsSchema.parse({
      departmentName: "Platform Engineering",
      autoCreatePeriods: false,
      defaultDeadlineDays: 3,
    });
    const mapped = mapAdminSettings(api);
    expect(mapped).toStrictEqual({
      departmentName: "Platform Engineering",
      autoCreatePeriods: false,
      defaultDeadlineDays: 3,
    });
  });
});
