import { type AdminSnapshot, adminSnapshotSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { mapAdminSnapshot } from "./admin";

// Valid v4-shape UUIDs (variant 8/9/a/b in 19th hex char, version 4 in 13th).
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";
const UUID_GROUP = "55555555-5555-4555-8555-555555555555";

const OPEN_LIFECYCLE = {
  status: "draft" as const,
  periodState: "open" as const,
  periodStatus: "open" as const,
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
  publishedSnapshot: null,
};

const PUBLISHED_LIFECYCLE = {
  ...OPEN_LIFECYCLE,
  status: "published" as const,
  periodState: "published" as const,
  periodStatus: "published" as const,
  publishedAt: "2026-04-18T18:30:00.000Z",
  publishedById: UUID_C,
};

const PUBLISHED_SNAPSHOT = {
  reportId: UUID_A,
  periodStart: "2026-04-13T00:00:00.000Z",
  periodEnd: "2026-04-19T23:59:59.000Z",
  deadline: "2026-04-18T18:00:00.000Z",
  status: "published" as const,
  publishedAt: "2026-04-18T18:30:00.000Z",
  publishedById: UUID_C,
  publishedByName: "Viewer Person",
  portfolioOverview: {
    status: "green" as const,
    totals: { green: 0, yellow: 0, red: 0 },
  },
  sections: [],
};

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
        lastName: "Lead",
        firstName: "Person",
        middleName: null,
        position: null,
        role: "lead",
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Core Development",
      },
      {
        id: UUID_B,
        email: "head@x.io",
        name: "Head Person",
        lastName: "Head",
        firstName: "Person",
        middleName: null,
        position: null,
        role: "head",
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Core Development",
      },
      {
        id: UUID_C,
        email: "view@x.io",
        name: "Viewer Person",
        lastName: "Viewer",
        firstName: "Person",
        middleName: null,
        position: null,
        role: "viewer",
        reportingGroupId: null,
        reportingGroupName: null,
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
        weekLabel: "Apr 13–19",
        periodStart: "2026-04-13T00:00:00.000Z",
        periodEnd: "2026-04-19T23:59:59.000Z",
        deadline: "2026-04-18T18:00:00.000Z",
        ...PUBLISHED_LIFECYCLE,
        publishedSnapshot: PUBLISHED_SNAPSHOT,
      },
      {
        id: UUID_B,
        weekLabel: "Apr 20–26",
        periodStart: "2026-04-20T00:00:00.000Z",
        periodEnd: "2026-04-26T23:59:59.000Z",
        deadline: "2026-04-25T18:00:00.000Z",
        ...OPEN_LIFECYCLE,
      },
    ],
    reminderRules: overrides.reminderRules ?? [
      {
        id: UUID_A,
        reportId: UUID_B,
        policyId: UUID_D,
        kind: "deadline",
        deadline: "2026-04-25T18:00:00.000Z",
        fireAt: "2026-04-24T18:00:00.000Z",
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
      },
    ],
    reminderExecutions: overrides.reminderExecutions ?? [],
    policies: overrides.policies ?? [
      {
        id: UUID_D,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "lead-with-draft",
        active: true,
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: null,
      },
    ],
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
      policies: [],
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
    expect(viewer?.groupId).toBe("");
    expect(viewer?.department).toBe("No owning group");
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
    expect(period?.weekLabel).toBe("Week 16, Apr 13–19, 2026");
    expect(period?.startDate).toBe("2026-04-13");
    expect(period?.endDate).toBe("2026-04-19");
    expect(period?.deadline).toBe("2026-04-18");
  });

  it("maps generated rules only to the fields used by reminder cards", () => {
    const mapped = mapAdminSnapshot(makeSnapshot());
    expect(mapped.reminders).toStrictEqual([
      {
        policyId: UUID_D,
        fireAt: new Date("2026-04-24T18:00:00.000Z"),
        active: true,
      },
    ]);
  });

  it("maps reminder policies through the admin snapshot", () => {
    const validFrom = new Date("2026-04-20T00:00:00.000Z");
    const validUntil = new Date("2026-05-20T00:00:00.000Z");
    const mapped = mapAdminSnapshot(
      makeSnapshot({
        reminderRules: [],
        policies: [
          {
            id: UUID_D,
            kind: "escalation",
            offsetMinutes: 120,
            timezone: "Europe/Moscow",
            audience: "head-of-late",
            active: false,
            validFrom,
            validUntil,
          },
        ],
      }),
    );

    expect(mapped.policies).toStrictEqual([
      {
        id: UUID_D,
        kind: "escalation",
        offsetMinutes: 120,
        timezone: "Europe/Moscow",
        audience: "head-of-late",
        active: false,
        validFrom,
        validUntil,
      },
    ]);
  });

  it("preserves user IDs and emails exactly (no transformation)", () => {
    const snapshot = makeSnapshot({
      users: [
        {
          id: UUID_D,
          email: "preserved@example.com",
          name: "Stable Lead",
          lastName: "Stable",
          firstName: "Lead",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: UUID_GROUP,
          reportingGroupName: "Core Development",
          isActive: true,
        },
        {
          id: UUID_C,
          email: "publisher@example.com",
          name: "Publisher",
          lastName: "Publisher",
          firstName: "Person",
          middleName: null,
          position: null,
          role: "viewer",
          reportingGroupId: null,
          reportingGroupName: null,
          isActive: false,
        },
      ],
      projects: [
        {
          id: UUID_A,
          name: "CRM Portal",
          archived: false,
          leadId: UUID_D,
          leadName: "Stable Lead",
        },
        {
          id: UUID_B,
          name: "Legacy Tool",
          archived: true,
          leadId: UUID_D,
          leadName: "Stable Lead",
        },
      ],
    });
    const mapped = mapAdminSnapshot(snapshot);
    expect(mapped.users[0]?.id).toBe(UUID_D);
    expect(mapped.users[0]?.email).toBe("preserved@example.com");
    expect(mapped.users[0]?.name).toBe("Stable Lead");
  });
});
