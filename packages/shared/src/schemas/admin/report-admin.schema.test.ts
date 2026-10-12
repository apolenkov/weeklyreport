import { describe, expect, it } from "vitest";

import {
  adminReportPeriodSchema,
  adminSnapshotSchema,
  pdfRecoveryJobListSchema,
  pdfRecoveryJobSchema,
  pdfRecoveryRetryInputSchema,
  pdfRecoveryRetryResultSchema,
} from "./report-admin.schema.js";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REPORT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const POLICY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RULE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const EXECUTION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const ALTERNATE_ID = "20000000-0000-4000-8000-000000000002";

const lifecycle = {
  id: REPORT_ID,
  periodStart: "2026-08-24",
  periodEnd: "2026-08-30",
  deadline: null,
  weekLabel: null,
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
} as const;

const publishedSnapshot = {
  reportId: REPORT_ID,
  periodStart: "2026-08-24",
  periodEnd: "2026-08-30",
  deadline: null,
  status: "published",
  publishedAt: "2026-08-30T10:00:00.000Z",
  publishedById: null,
  publishedByName: null,
  portfolioOverview: {
    status: "green",
    totals: { green: 0, yellow: 0, red: 0 },
  },
  sections: [],
};

function snapshotWithUser(user: Record<string, unknown>) {
  return {
    users: [user],
    groups: [],
    projects: [],
    periods: [],
    reminderRules: [],
    reminderExecutions: [],
    policies: [],
  };
}

function user(role: "lead" | "head" | "admin" | "viewer") {
  return {
    id: USER_ID,
    email: "user@example.test",
    name: "User Example",
    lastName: "User",
    firstName: "Example",
    middleName: null,
    position: null,
    role,
    isActive: true,
  };
}

function group() {
  return {
    id: GROUP_ID,
    name: "Reporting Group",
    description: null,
    archived: false,
    headUserId: null,
  };
}

describe("adminSnapshotSchema — reporting group restore integrity", () => {
  it.each(["lead", "head", "admin"] as const)(
    "rejects a %s snapshot user without reportingGroupId",
    (role) => {
      const result = adminSnapshotSchema.safeParse(
        snapshotWithUser(user(role)),
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ["users", 0, "reportingGroupId"],
            }),
          ]),
        );
      }
    },
  );

  it("accepts a viewer without a reporting group", () => {
    expect(
      adminSnapshotSchema.safeParse(snapshotWithUser(user("viewer"))).success,
    ).toBe(true);
  });

  it("requires an explicit user lifecycle flag in a restore snapshot", () => {
    const { isActive: _omitted, ...withoutLifecycleFlag } = user("viewer");

    expect(
      adminSnapshotSchema.safeParse(snapshotWithUser(withoutLifecycleFlag))
        .success,
    ).toBe(false);
  });

  it("accepts a non-viewer with an explicit reporting group", () => {
    const snapshot = snapshotWithUser({
      ...user("lead"),
      reportingGroupId: GROUP_ID,
    });
    expect(
      adminSnapshotSchema.safeParse({ ...snapshot, groups: [group()] }).success,
    ).toBe(true);
  });
});

describe("adminSnapshotSchema — Head membership", () => {
  it.each([
    { role: "head", headedIds: [GROUP_ID], isActive: true, valid: true },
    { role: "head", headedIds: [GROUP_ID], isActive: false, valid: true },
    { role: "head", headedIds: [ALTERNATE_ID], isActive: true, valid: false },
    {
      role: "head",
      headedIds: [GROUP_ID, ALTERNATE_ID],
      isActive: true,
      valid: false,
    },
    { role: "admin", headedIds: [ALTERNATE_ID], isActive: true, valid: true },
    {
      role: "admin",
      headedIds: [GROUP_ID, ALTERNATE_ID],
      isActive: false,
      valid: true,
    },
  ] as const)(
    "validates $role/$isActive headings $headedIds against snapshot membership",
    ({ role, headedIds, isActive, valid }) => {
      const headedGroupIds: readonly string[] = headedIds;
      const result = adminSnapshotSchema.safeParse({
        ...snapshotWithUser({
          ...user(role),
          reportingGroupId: GROUP_ID,
          isActive,
        }),
        groups: [GROUP_ID, ALTERNATE_ID].map((id) => ({
          ...group(),
          id,
          headUserId: headedGroupIds.includes(id) ? USER_ID : null,
        })),
      });
      expect(result.success).toBe(valid);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: ["groups", 1, "headUserId"] }),
          ]),
        );
      }
    },
  );
});

describe("adminSnapshotSchema — publisher recovery integrity", () => {
  const period = {
    ...lifecycle,
    status: "published" as const,
    periodState: "published" as const,
    periodStatus: "published" as const,
    publishedAt: "2026-08-30T10:00:00.000Z",
    publishedById: USER_ID,
    publishedSnapshot: {
      ...publishedSnapshot,
      publishedById: USER_ID,
      publishedByName: "User Example",
    },
  };

  it("requires every publishedById to reference a snapshot user", () => {
    const snapshot = {
      ...snapshotWithUser(user("viewer")),
      periods: [period],
    };
    expect(adminSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      adminSnapshotSchema.safeParse({ ...snapshot, users: [] }).success,
    ).toBe(false);
  });
});

const reminderPayload = {
  contractVersion: 1,
  kind: "deadline",
  cycleDate: "2026-08-29",
  leadName: "Lead Example",
  reportPeriod: "2026-08-24 → 2026-08-30",
  deadlineIso: "2026-08-29T15:00:00.000Z",
  sectionUrl: `https://reports.example.test/lead/report/${REPORT_ID}`,
  organization: {
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
  },
} as const;

function snapshotWithReminderExecution() {
  return {
    users: [],
    groups: [],
    projects: [],
    periods: [
      {
        ...lifecycle,
        status: "draft",
        deadline: "2026-08-29T15:00:00.000Z",
        publishedSnapshot: null,
      },
    ],
    policies: [
      {
        id: POLICY_ID,
        kind: "deadline",
        offsetMinutes: 0,
        timezone: "Europe/Moscow",
        audience: "lead-with-draft",
        active: true,
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: null,
      },
    ],
    reminderRules: [
      {
        id: RULE_ID,
        reportId: REPORT_ID,
        policyId: POLICY_ID,
        kind: "deadline",
        fireAt: "2026-08-29T15:00:00.000Z",
        deadline: "2026-08-29T15:00:00.000Z",
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
      },
    ],
    reminderExecutions: [
      {
        id: EXECUTION_ID,
        ruleId: RULE_ID,
        reportId: REPORT_ID,
        dedupeKey: `${RULE_ID}:deadline:2026-08-29:lead@example.test`,
        status: "queued",
        scheduledFor: "2026-08-29T15:00:00.000Z",
        sentAt: null,
        recipientEmail: "lead@example.test",
        errorMessage: null,
        queuePayload: reminderPayload,
        createdAt: "2026-08-29T14:00:00.000Z",
        updatedAt: "2026-08-29T14:00:00.000Z",
      },
    ],
  };
}

function completeSnapshot() {
  return {
    ...snapshotWithReminderExecution(),
    users: [
      {
        ...user("lead"),
        reportingGroupId: GROUP_ID,
        reportingGroupName: "Reporting Group",
      },
    ],
    groups: [group()],
    projects: [
      {
        id: PROJECT_ID,
        name: "Product",
        archived: false,
        leadId: USER_ID,
        leadName: "User Example",
      },
    ],
  };
}

function firstUser(snapshot: ReturnType<typeof completeSnapshot>) {
  const first = snapshot.users.at(0);
  if (!first) throw new Error("Missing user fixture.");
  return first;
}

function firstReminderRule(
  snapshot: ReturnType<typeof snapshotWithReminderExecution>,
) {
  const first = snapshot.reminderRules.at(0);
  if (!first) throw new Error("Missing reminder rule fixture.");
  return first;
}

type SnapshotCollection =
  | "groups"
  | "periods"
  | "policies"
  | "projects"
  | "reminderExecutions"
  | "reminderRules"
  | "users";

function duplicateFirstRow(collection: SnapshotCollection) {
  const snapshot = completeSnapshot();
  const rows: readonly unknown[] = snapshot[collection];
  const first = rows.at(0);
  if (first === undefined) throw new Error(`Missing ${collection} fixture.`);
  return {
    ...snapshot,
    [collection]: [...rows, structuredClone(first)],
  };
}

describe("adminSnapshotSchema — deterministic identity and FK closure", () => {
  it.each([
    "users",
    "groups",
    "projects",
    "periods",
    "reminderRules",
    "reminderExecutions",
    "policies",
  ] as const)("rejects duplicate ids in %s", (collection) => {
    const result = adminSnapshotSchema.safeParse(duplicateFirstRow(collection));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: [collection, 1, "id"] }),
      );
    }
  });

  it.each([
    [
      "case-insensitive user email",
      "users",
      "email",
      (snapshot: ReturnType<typeof completeSnapshot>) => ({
        ...snapshot,
        users: [
          ...snapshot.users,
          {
            ...firstUser(snapshot),
            id: ALTERNATE_ID,
            email: firstUser(snapshot).email.toUpperCase(),
          },
        ],
      }),
    ],
    [
      "report-policy-version rule tuple",
      "reminderRules",
      "policyId",
      (snapshot: ReturnType<typeof completeSnapshot>) => ({
        ...snapshot,
        reminderRules: [
          ...snapshot.reminderRules,
          { ...snapshot.reminderRules[0], id: ALTERNATE_ID },
        ],
      }),
    ],
    [
      "execution dedupe key",
      "reminderExecutions",
      "dedupeKey",
      (snapshot: ReturnType<typeof completeSnapshot>) => ({
        ...snapshot,
        reminderExecutions: [
          ...snapshot.reminderExecutions,
          { ...snapshot.reminderExecutions[0], id: ALTERNATE_ID },
        ],
      }),
    ],
  ] as const)(
    "rejects a duplicate %s business key",
    (_label, collection, field, mutate) => {
      const result = adminSnapshotSchema.safeParse(mutate(completeSnapshot()));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path: [collection, 1, field] }),
        );
      }
    },
  );

  it("reports repeated business keys in row order against the first row", () => {
    const snapshot = completeSnapshot();
    const first = firstUser(snapshot);
    const result = adminSnapshotSchema.safeParse({
      ...snapshot,
      users: [
        first,
        { ...first, id: ALTERNATE_ID },
        {
          ...first,
          id: "30000000-0000-4000-8000-000000000003",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.filter((issue) => issue.path.at(-1) === "email"),
      ).toEqual([
        expect.objectContaining({
          path: ["users", 1, "email"],
          message: "User email duplicates users[0].",
        }),
        expect.objectContaining({
          path: ["users", 2, "email"],
          message: "User email duplicates users[0].",
        }),
      ]);
    }
  });

  it.each([
    [
      "user group",
      ["users", 0, "reportingGroupId"],
      (snapshot: ReturnType<typeof completeSnapshot>) => ({
        ...snapshot,
        users: [{ ...snapshot.users[0], reportingGroupId: ALTERNATE_ID }],
      }),
    ],
    [
      "group head",
      ["groups", 0, "headUserId"],
      (snapshot: ReturnType<typeof completeSnapshot>) => ({
        ...snapshot,
        groups: [{ ...snapshot.groups[0], headUserId: ALTERNATE_ID }],
      }),
    ],
    [
      "project lead",
      ["projects", 0, "leadId"],
      (snapshot: ReturnType<typeof completeSnapshot>) => ({
        ...snapshot,
        projects: [{ ...snapshot.projects[0], leadId: ALTERNATE_ID }],
      }),
    ],
  ] as const)(
    "rejects a cross-snapshot %s reference",
    (_label, path, mutate) => {
      const result = adminSnapshotSchema.safeParse(mutate(completeSnapshot()));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path }),
        );
      }
    },
  );

  it("requires a group head reference to resolve to a head or admin", () => {
    const snapshot = completeSnapshot();
    const result = adminSnapshotSchema.safeParse({
      ...snapshot,
      groups: [{ ...snapshot.groups[0], headUserId: USER_ID }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["groups", 0, "headUserId"] }),
      );
    }
  });

  it("rejects a rule kind that differs from its policy", () => {
    const snapshot = completeSnapshot();
    const result = adminSnapshotSchema.safeParse({
      ...snapshot,
      reminderRules: [{ ...snapshot.reminderRules[0], kind: "escalation" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["reminderRules", 0, "kind"] }),
      );
    }
  });

  it("rejects an invalid policy kind-audience pair through recovery", () => {
    const snapshot = completeSnapshot();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        policies: [{ ...snapshot.policies[0], audience: "head-of-late" }],
      }).success,
    ).toBe(false);
  });
});

describe("adminSnapshotSchema — reminder execution recovery", () => {
  it("accepts a lifecycle-complete execution with its exact current payload", () => {
    expect(
      adminSnapshotSchema.safeParse(snapshotWithReminderExecution()).success,
    ).toBe(true);
  });

  it("preserves a sent execution against its historical rule after schedule and policy edits", () => {
    const snapshot = snapshotWithReminderExecution();
    const currentDeadline = "2026-09-05T16:00:00.000Z";
    const historicalRule = {
      ...firstReminderRule(snapshot),
      status: "paused" as const,
    };
    const currentRule = {
      ...historicalRule,
      id: ALTERNATE_ID,
      kind: "escalation" as const,
      deadline: currentDeadline,
      fireAt: currentDeadline,
      status: "active" as const,
      version: 2,
    };
    const result = adminSnapshotSchema.safeParse({
      ...snapshot,
      periods: snapshot.periods.map((period) => ({
        ...period,
        deadline: currentDeadline,
      })),
      policies: snapshot.policies.map((policy) => ({
        ...policy,
        kind: "escalation" as const,
        audience: "head-of-late" as const,
      })),
      reminderRules: [historicalRule, currentRule],
      reminderExecutions: snapshot.reminderExecutions.map((execution) => ({
        ...execution,
        status: "sent" as const,
        sentAt: "2026-08-29T15:01:00.000Z",
      })),
    });

    expect(result.success).toBe(true);
  });

  it("rejects an active superseded reminder rule version", () => {
    const snapshot = snapshotWithReminderExecution();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        reminderRules: [
          snapshot.reminderRules[0],
          {
            ...snapshot.reminderRules[0],
            id: ALTERNATE_ID,
            version: 2,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-contiguous reminder rule version sequence", () => {
    const snapshot = snapshotWithReminderExecution();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        reminderRules: [
          { ...snapshot.reminderRules[0], status: "paused" as const },
          {
            ...snapshot.reminderRules[0],
            id: ALTERNATE_ID,
            version: 3,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it.each(["groups", "policies", "reminderExecutions"] as const)(
    "requires the current-version %s array",
    (field) => {
      const snapshot = snapshotWithReminderExecution();
      const { [field]: _omitted, ...withoutRequiredArray } = snapshot;
      expect(adminSnapshotSchema.safeParse(withoutRequiredArray).success).toBe(
        false,
      );
    },
  );

  it("rejects an active reminder rule owned by an inactive policy", () => {
    const snapshot = snapshotWithReminderExecution();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        policies: snapshot.policies.map((policy) => ({
          ...policy,
          active: false,
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects an unsupported reminder kind during recovery", () => {
    const snapshot = snapshotWithReminderExecution();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        reminderRules: snapshot.reminderRules.map((rule) => ({
          ...rule,
          kind: "unsupported",
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects an execution whose persisted queue payload is missing", () => {
    const snapshot = snapshotWithReminderExecution();
    const sourceExecution = snapshot.reminderExecutions.at(0);
    if (!sourceExecution) throw new Error("missing reminder execution fixture");
    const { queuePayload: _queuePayload, ...execution } = sourceExecution;

    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        reminderExecutions: [execution],
      }).success,
    ).toBe(false);
  });

  it.each([
    ["sent without sentAt", { status: "sent", sentAt: null }],
    [
      "sent with error",
      {
        status: "sent",
        sentAt: "2026-08-29T15:01:00.000Z",
        errorMessage: "unexpected",
      },
    ],
    [
      "queued with sentAt",
      { status: "queued", sentAt: "2026-08-29T15:01:00.000Z" },
    ],
    ["queued with error", { status: "queued", errorMessage: "unexpected" }],
    [
      "sending with outcome",
      {
        status: "sending",
        sentAt: "2026-08-29T15:01:00.000Z",
        errorMessage: "unexpected",
      },
    ],
    ["failed without error", { status: "failed", errorMessage: null }],
    [
      "failed with whitespace-only error",
      { status: "failed", errorMessage: " ".repeat(3) },
    ],
    [
      "failed with sentAt",
      {
        status: "failed",
        sentAt: "2026-08-29T15:01:00.000Z",
        errorMessage: "SMTP refused",
      },
    ],
  ] as const)("rejects incoherent lifecycle: %s", (_label, override) => {
    const snapshot = snapshotWithReminderExecution();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        reminderExecutions: [
          { ...snapshot.reminderExecutions[0], ...override },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([
    ["unknown rule", { ruleId: USER_ID }],
    ["cross-linked report", { reportId: USER_ID }],
    [
      "payload cycle",
      {
        queuePayload: { ...reminderPayload, cycleDate: "2026-08-30" },
      },
    ],
    [
      "payload report deadline",
      {
        queuePayload: {
          ...reminderPayload,
          deadlineIso: "2026-08-29T16:00:00.000Z",
        },
      },
    ],
    [
      "payload report URL",
      {
        queuePayload: {
          ...reminderPayload,
          sectionUrl: `https://reports.example.test/lead/report/${USER_ID}`,
        },
      },
    ],
    ["dedupe identity", { dedupeKey: "wrong-key" }],
  ] as const)("rejects invalid %s identity fail-closed", (_label, override) => {
    const snapshot = snapshotWithReminderExecution();
    expect(
      adminSnapshotSchema.safeParse({
        ...snapshot,
        reminderExecutions: [
          { ...snapshot.reminderExecutions[0], ...override },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("adminReportPeriodSchema — publication recovery", () => {
  const publishedPeriod = {
    ...lifecycle,
    status: "published" as const,
    periodState: "published" as const,
    periodStatus: "published" as const,
    publishedAt: "2026-08-30T10:00:00.000Z",
    publishedById: null,
    publishedSnapshot,
  };

  it("requires a validated immutable snapshot for published rows", () => {
    expect(
      adminReportPeriodSchema.safeParse({
        ...lifecycle,
        status: "published",
      }).success,
    ).toBe(false);
    expect(adminReportPeriodSchema.safeParse(publishedPeriod).success).toBe(
      true,
    );
    expect(
      adminReportPeriodSchema.safeParse({
        ...lifecycle,
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: "2026-08-30T10:00:00.000Z",
        publishedSnapshot: { ...publishedSnapshot, status: "draft" },
      }).success,
    ).toBe(false);
  });

  it("keeps draft rows explicitly snapshot-free", () => {
    expect(
      adminReportPeriodSchema.safeParse({
        ...lifecycle,
        status: "draft",
        publishedSnapshot: null,
      }).success,
    ).toBe(true);
    expect(
      adminReportPeriodSchema.safeParse({
        ...lifecycle,
        status: "draft",
        publishedSnapshot,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["periodStart", "2026-08-23"],
    ["periodEnd", "2026-08-31"],
    ["deadline", "2026-08-29T12:00:00.000Z"],
    ["publishedAt", "2026-08-30T11:00:00.000Z"],
    ["publishedById", USER_ID],
  ] as const)("rejects contradictory published %s metadata", (field, value) => {
    expect(
      adminReportPeriodSchema.safeParse({
        ...publishedPeriod,
        publishedSnapshot: { ...publishedSnapshot, [field]: value },
      }).success,
    ).toBe(false);
  });

  it("allows a reopened row to retain its prior publication envelope", () => {
    expect(
      adminReportPeriodSchema.safeParse({
        ...publishedPeriod,
        periodStart: "2026-08-25",
        periodEnd: "2026-08-31",
        deadline: "2026-08-29T12:00:00.000Z",
        periodState: "open",
        periodStatus: "reopened",
        reopenedAt: "2026-08-30T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});

describe("adminReportPeriodSchema — week label recovery", () => {
  const draft = {
    ...lifecycle,
    status: "draft" as const,
    publishedSnapshot: null,
  };

  it("requires the nullable admin-owned week label", () => {
    expect(adminReportPeriodSchema.safeParse(draft).success).toBe(true);
    const { weekLabel: _omitted, ...withoutWeekLabel } = draft;
    expect(adminReportPeriodSchema.safeParse(withoutWeekLabel).success).toBe(
      false,
    );
  });
});

describe("PDF export recovery contracts", () => {
  const recoveryJob = {
    jobId: EXECUTION_ID,
    reportId: REPORT_ID,
    generation: 2,
    requestedBy: USER_ID,
    status: "recovery_required",
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
  } as const;

  it("round-trips a quarantined export row with its generation", () => {
    const parsed = pdfRecoveryJobSchema.parse(recoveryJob);

    expect(parsed).toEqual(recoveryJob);
  });

  it("round-trips a terminally failed export row awaiting head retry", () => {
    const failedJob = { ...recoveryJob, status: "failed" } as const;

    expect(pdfRecoveryJobSchema.parse(failedJob)).toEqual(failedJob);
  });

  it.each(["queued", "completed"] as const)(
    "rejects a recovery list row in the %s state",
    (status) => {
      expect(
        pdfRecoveryJobSchema.safeParse({ ...recoveryJob, status }).success,
      ).toBe(false);
    },
  );

  it("wraps the DB-backed recovery list, empty or populated", () => {
    expect(
      pdfRecoveryJobListSchema.parse({ jobs: [recoveryJob] }).jobs,
    ).toHaveLength(1);
    expect(pdfRecoveryJobListSchema.safeParse({ jobs: [] }).success).toBe(true);
  });

  it("round-trips the generation-bound retry input", () => {
    const parsed = pdfRecoveryRetryInputSchema.parse({
      jobId: recoveryJob.jobId,
      expectedGeneration: recoveryJob.generation,
    });

    expect(parsed).toEqual({ jobId: recoveryJob.jobId, expectedGeneration: 2 });
  });

  it.each([0, -1, 1.5, "2", undefined])(
    "rejects retry input with expectedGeneration %s",
    (expectedGeneration) => {
      expect(
        pdfRecoveryRetryInputSchema.safeParse({
          jobId: recoveryJob.jobId,
          expectedGeneration,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects a non-uuid retry jobId", () => {
    expect(
      pdfRecoveryRetryInputSchema.safeParse({
        jobId: "not-a-uuid",
        expectedGeneration: 1,
      }).success,
    ).toBe(false);
  });

  it.each(["retried", "already-advanced", "ineligible"] as const)(
    "distinguishes the %s retry outcome",
    (outcome) => {
      const parsed = pdfRecoveryRetryResultSchema.parse({
        jobId: recoveryJob.jobId,
        outcome,
      });

      expect(parsed).toEqual({ jobId: recoveryJob.jobId, outcome });
    },
  );

  it("rejects the removed queue-retry outcome vocabulary", () => {
    expect(
      pdfRecoveryRetryResultSchema.safeParse({
        jobId: recoveryJob.jobId,
        outcome: "queue-not-failed",
      }).success,
    ).toBe(false);
  });
});
