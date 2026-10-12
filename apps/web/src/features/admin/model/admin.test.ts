import { type AdminSnapshot, adminSnapshotSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined";
import { mapAdminSnapshot, toAdminUserInput } from "./admin";
import { formFromUser } from "./user-form";

// Valid v4-shape UUIDs (variant 8/9/a/b in 19th hex char, version 4 in 13th).
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";
const UUID_GROUP = "55555555-5555-4555-8555-555555555555";

const REMINDER_EXECUTION = {
  id: "66666666-6666-4666-8666-666666666666",
  ruleId: UUID_A,
  reportId: UUID_B,
  dedupeKey: `${UUID_A}:deadline:2026-04-24:lead@example.com`,
  status: "sending" as const,
  scheduledFor: new Date("2026-04-24T18:00:00.000Z"),
  sentAt: null,
  recipientEmail: "lead@example.com",
  errorMessage: null,
  queuePayload: {
    kind: "deadline" as const,
    contractVersion: 1 as const,
    cycleDate: "2026-04-24",
    leadName: "Lead Person",
    reportPeriod: "Apr 20–26",
    deadlineIso: "2026-04-25T18:00:00.000Z",
    sectionUrl: `https://example.com/lead/report/${UUID_B}`,
    organization: { shortName: "CR", fullName: "CustomReport" },
  },
  createdAt: new Date("2026-04-25T17:00:00.000Z"),
  updatedAt: new Date("2026-04-25T17:01:00.000Z"),
};

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
        name: "Software Development",
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
        isActive: true,
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Software Development",
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
        isActive: true,
        reportingGroupId: UUID_GROUP,
        reportingGroupName: "Software Development",
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
        isActive: true,
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
    expect(mapped.reminders).toEqual([]);
    expect(mapped.executions).toEqual([]);
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
    expect(lead?.department).toBe("Software Development");
    expect(viewer?.groupId).toBeNull();
    expect(viewer?.department).toBe("No owning group");
  });

  it("round-trips a valid owning group from snapshot through form submit", () => {
    const lead = expectDefined(
      mapAdminSnapshot(makeSnapshot()).users.find((user) => user.id === UUID_A),
    );

    const submitted = toAdminUserInput(formFromUser(lead), lead.id);

    expect(submitted.reportingGroupId).toBe(UUID_GROUP);
    expect(submitted.role).toBe("lead");
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

  it("keeps durable reminder execution outcomes for the delivery activity view", () => {
    const mapped = mapAdminSnapshot(
      makeSnapshot({ reminderExecutions: [REMINDER_EXECUTION] }),
    );

    expect(mapped.executions).toStrictEqual([
      {
        id: REMINDER_EXECUTION.id,
        ruleId: REMINDER_EXECUTION.ruleId,
        reportId: REMINDER_EXECUTION.reportId,
        status: "sending",
        scheduledFor: new Date(REMINDER_EXECUTION.scheduledFor),
        sentAt: null,
        recipientEmail: REMINDER_EXECUTION.recipientEmail,
        errorMessage: null,
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
          reportingGroupName: "Software Development",
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
