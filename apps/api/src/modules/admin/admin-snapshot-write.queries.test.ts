import { adminSnapshotReminderExecutionSchema } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { writePeriodRow } from "./admin-entity-write.queries.js";
import { AdminSnapshotConflictError } from "./admin-errors.js";
import { lockRestoredReports } from "./admin-snapshot/period-locks.js";
import { upsertReminderExecutions } from "./admin-snapshot/reminder-execution-restore.js";
import { lockReminderRestoreGraph } from "./admin-snapshot/reminder-locks.js";
import {
  reconcileRestoredReminderRuleStatuses,
  upsertReminderPolicies,
  upsertReminderRules,
} from "./admin-snapshot/reminders.js";
import { saveSnapshot } from "./admin-snapshot-write.queries.js";

function sqlText(value: unknown): string {
  if (typeof value !== "object" || value === null || !("sql" in value)) {
    return "";
  }
  return typeof value.sql === "string" ? value.sql : "";
}

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPORT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECTION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AUTHOR_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const GROUP_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const STABLE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000001";

describe("saveSnapshot — reporting-group integrity", () => {
  it("rejects a groupless lead before opening a restore transaction", async () => {
    const transaction = vi.fn();
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const malformedSnapshot = {
      users: [
        {
          id: USER_ID,
          email: "lead@example.test",
          name: "Lead Example",
          lastName: "Lead",
          firstName: "Example",
          middleName: null,
          position: null,
          role: "lead",
          isActive: true,
        },
      ],
      groups: [],
      projects: [],
      periods: [],
      reminderRules: [],
      reminderExecutions: [],
      policies: [],
    };

    await expect(
      saveSnapshot(prisma, undefined, malformedSnapshot as never),
    ).rejects.toThrow(/reportingGroupId/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a published record without id before opening a restore transaction", async () => {
    const transaction = vi.fn();
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const publishedAt = new Date("2026-04-19T15:00:00.000Z");
    const periodStart = new Date("2026-04-13T00:00:00.000Z");
    const periodEnd = new Date("2026-04-19T23:59:59.000Z");
    const malformedSnapshot = {
      users: [],
      groups: [],
      projects: [],
      periods: [
        {
          id: REPORT_ID,
          periodStart,
          periodEnd,
          deadline: null,
          status: "published",
          periodState: "published",
          periodStatus: "published",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt,
          publishedById: null,
          reopenedAt: null,
          publishedSnapshot: {
            reportId: REPORT_ID,
            periodStart,
            periodEnd,
            deadline: null,
            status: "published",
            publishedAt,
            publishedById: null,
            publishedByName: null,
            portfolioOverview: {
              status: "green",
              totals: { green: 0, yellow: 0, red: 0 },
            },
            sections: [
              {
                reportSectionId: SECTION_ID,
                reportId: REPORT_ID,
                authorId: AUTHOR_ID,
                authorName: "Recovered Lead",
                authorRole: "lead",
                version: 1,
                status: "submitted",
                submittedAt: publishedAt,
                late: false,
                projects: [],
                referencedProjects: [],
                items: [
                  {
                    stableId: STABLE_ID,
                    projectId: null,
                    activityId: ACTIVITY_ID,
                    type: "current",
                    text: "Published item",
                    tag: "general",
                    workflowStatus: "in_progress",
                    carriedOver: false,
                    stageNames: [],
                  },
                ],
                risks: [],
                decisions: [],
                activities: [],
                reviews: [],
                groupId: GROUP_ID,
                groupName: "Recovered Group",
              },
            ],
          },
        },
      ],
      reminderRules: [],
      reminderExecutions: [],
      policies: [],
    };

    await expect(
      saveSnapshot(prisma, undefined, malformedSnapshot as never),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("saveSnapshot — deterministic pre-transaction validation", () => {
  it.each(["fresh", "populated"])(
    "rejects duplicate business identity against a %s database without reading it",
    async (_databaseState) => {
      const transaction = vi.fn();
      const prisma = { $transaction: transaction } as unknown as PrismaService;
      const viewer = {
        id: USER_ID,
        email: "viewer@example.test",
        name: "Viewer Example",
        lastName: "Viewer",
        firstName: "Example",
        middleName: null,
        position: null,
        role: "viewer",
        isActive: true,
      };
      const duplicateEmailSnapshot = {
        users: [
          viewer,
          {
            ...viewer,
            id: "10000000-0000-4000-8000-000000000010",
            email: viewer.email.toUpperCase(),
          },
        ],
        groups: [],
        projects: [],
        periods: [],
        reminderRules: [],
        reminderExecutions: [],
        policies: [],
      };

      await expect(
        saveSnapshot(prisma, undefined, duplicateEmailSnapshot as never),
      ).rejects.toThrow(/User email duplicates users\[0\]/);
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});

describe("lockReminderRestoreGraph — canonical policy ownership locks", () => {
  it("fails closed when a rule moves to an unlocked policy during lock acquisition", async () => {
    const ruleId = "10000000-0000-4000-8000-000000000011";
    const oldPolicyId = "10000000-0000-4000-8000-000000000012";
    const targetPolicyId = "10000000-0000-4000-8000-000000000013";
    const racedPolicyId = "10000000-0000-4000-8000-000000000014";
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      reminderRule: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ policyId: oldPolicyId }])
          .mockResolvedValueOnce([
            {
              id: ruleId,
              reportId: REPORT_ID,
              policyId: racedPolicyId,
              kind: "deadline",
              fireAt: new Date("2026-04-10T09:00:00.000Z"),
              deadline: new Date("2026-04-11T09:00:00.000Z"),
              timezone: "Europe/Moscow",
              version: 1,
              _count: { executions: 0 },
            },
          ]),
      },
    };

    await expect(
      lockReminderRestoreGraph(tx as never, [ruleId], [targetPolicyId]),
    ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
  });

  it("discovers and locks policies for retained rules on restored reports", async () => {
    const targetPolicyId = "10000000-0000-4000-8000-000000000015";
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      reminderRule: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ policyId: targetPolicyId }])
          .mockResolvedValueOnce([]),
      },
    };

    await lockReminderRestoreGraph(tx as never, [], [], [REPORT_ID]);

    expect(tx.reminderRule.findMany).toHaveBeenNthCalledWith(1, {
      where: { OR: [{ reportId: { in: [REPORT_ID] } }] },
      select: { policyId: true },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const queryCalls: readonly unknown[][] = vi.mocked(tx.$queryRaw).mock.calls;
    expect(sqlText(queryCalls[0]?.[0])).toContain('FROM "ReminderPolicy"');
    expect(sqlText(queryCalls[1]?.[0])).toContain('FROM "ReminderRule"');
  });
});

describe("lockRestoredReports — lifecycle restore barrier", () => {
  it("deduplicates and sorts report locks before period writes", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await lockRestoredReports(tx as never, [REPORT_ID, USER_ID, REPORT_ID]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const queryCalls: readonly unknown[][] = vi.mocked(tx.$queryRaw).mock.calls;
    expect(sqlText(queryCalls[0]?.[0])).toContain('FROM "Report"');
    expect(sqlText(queryCalls[0]?.[0])).toContain("FOR UPDATE");
  });
});

const executionCreatedAt = new Date("2026-04-10T08:00:00.000Z");
const executionUpdatedAt = new Date("2026-04-10T08:30:00.000Z");
const queuePayload = {
  contractVersion: 1,
  kind: "deadline",
  cycleDate: "2026-04-10",
  leadName: "Lead Example",
  reportPeriod: "2026-04-06 → 2026-04-12",
  deadlineIso: "2026-04-10T09:00:00.000Z",
  sectionUrl:
    "https://example.test/lead/report/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  organization: {
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
  },
} as const;
const recoveryExecution = adminSnapshotReminderExecutionSchema.parse({
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  ruleId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  dedupeKey:
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:deadline:2026-04-10:lead@example.test",
  status: "queued",
  scheduledFor: new Date("2026-04-10T09:00:00.000Z"),
  sentAt: null,
  recipientEmail: "lead@example.test",
  errorMessage: null,
  queuePayload,
  createdAt: executionCreatedAt,
  updatedAt: executionUpdatedAt,
});

function executionRestoreTx(existingRows: readonly object[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    reminderExecution: {
      findMany: vi.fn().mockResolvedValue(existingRows),
      create: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

const liveExecution = (status: "pending" | "sending" | "sent" | "failed") => ({
  id: recoveryExecution.id,
  ruleId: recoveryExecution.ruleId,
  recipientEmail: recoveryExecution.recipientEmail,
  dedupeKey: recoveryExecution.dedupeKey,
  status,
  sentAt: status === "sent" ? new Date("2026-04-10T09:01:00.000Z") : null,
  error: status === "failed" ? "terminal SMTP failure" : null,
  queuePayload,
  createdAt: executionCreatedAt,
  updatedAt: new Date("2026-04-10T10:00:00.000Z"),
});

describe("upsertReminderExecutions — monotonic recovery", () => {
  it("creates a missing queued execution with exact durable data", async () => {
    const tx = executionRestoreTx([]);

    await upsertReminderExecutions(tx as never, [recoveryExecution]);

    expect(tx.reminderExecution.create).toHaveBeenCalledWith({
      data: {
        id: recoveryExecution.id,
        ruleId: recoveryExecution.ruleId,
        recipientEmail: recoveryExecution.recipientEmail,
        dedupeKey: recoveryExecution.dedupeKey,
        status: "pending",
        sentAt: null,
        error: null,
        queuePayload,
        createdAt: executionCreatedAt,
        updatedAt: executionUpdatedAt,
      },
    });
  });

  it.each(["sending", "sent", "failed"] as const)(
    "does not regress a live %s execution to a stale queued snapshot",
    async (status) => {
      const tx = executionRestoreTx([liveExecution(status)]);

      await upsertReminderExecutions(tx as never, [recoveryExecution]);

      expect(tx.reminderExecution.updateMany).not.toHaveBeenCalled();
      expect(tx.reminderExecution.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["sent", { sentAt: new Date("2026-04-10T09:02:00.000Z") }],
    ["failed", { errorMessage: "different terminal SMTP failure" }],
  ] as const)(
    "rejects newer conflicting %s outcome data",
    async (status, outcome) => {
      const existing = liveExecution(status);
      const snapshot = {
        ...recoveryExecution,
        status,
        sentAt: status === "sent" ? new Date("2026-04-10T09:01:00.000Z") : null,
        errorMessage: status === "failed" ? existing.error : null,
        updatedAt: new Date("2026-04-10T10:01:00.000Z"),
        ...outcome,
      };

      await expect(
        upsertReminderExecutions(executionRestoreTx([existing]) as never, [
          snapshot,
        ]),
      ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
    },
  );

  it("advances queued to sent through a compare-and-set", async () => {
    const existing = {
      ...liveExecution("pending"),
      updatedAt: new Date("2026-04-10T08:45:00.000Z"),
    };
    const sentSnapshot = {
      ...recoveryExecution,
      status: "sent" as const,
      sentAt: new Date("2026-04-10T09:01:00.000Z"),
      updatedAt: new Date("2026-04-10T09:01:00.000Z"),
    };
    const tx = executionRestoreTx([existing]);

    await upsertReminderExecutions(tx as never, [sentSnapshot]);

    expect(tx.reminderExecution.updateMany).toHaveBeenCalledWith({
      where: {
        id: recoveryExecution.id,
        status: "pending",
        updatedAt: existing.updatedAt,
      },
      data: {
        status: "sent",
        sentAt: sentSnapshot.sentAt,
        error: null,
        updatedAt: sentSnapshot.updatedAt,
      },
    });
  });

  it.each([
    ["sent", "pending"],
    ["sending", "pending"],
    ["failed", "sending"],
  ] as const)(
    "does not apply a stale %s snapshot over a newer live %s state",
    async (snapshotStatus, liveStatus) => {
      const tx = executionRestoreTx([liveExecution(liveStatus)]);
      const staleSnapshot = {
        ...recoveryExecution,
        status: snapshotStatus,
        sentAt:
          snapshotStatus === "sent"
            ? new Date("2026-04-10T09:01:00.000Z")
            : null,
        errorMessage:
          snapshotStatus === "failed" ? "old terminal failure" : null,
        updatedAt: new Date("2026-04-10T09:00:00.000Z"),
      };

      await upsertReminderExecutions(tx as never, [staleSnapshot]);

      expect(tx.reminderExecution.updateMany).not.toHaveBeenCalled();
    },
  );

  it("rejects different lifecycle data at the same timestamp", async () => {
    const existing = {
      ...liveExecution("sending"),
      updatedAt: recoveryExecution.updatedAt,
    };
    const tx = executionRestoreTx([existing]);

    await expect(
      upsertReminderExecutions(tx as never, [recoveryExecution]),
    ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
  });

  it.each(["sending", "sent", "failed"] as const)(
    "rejects a newer queued snapshot over a live %s execution",
    async (status) => {
      const existing = liveExecution(status);
      const tx = executionRestoreTx([existing]);
      const newerQueuedSnapshot = {
        ...recoveryExecution,
        updatedAt: new Date("2026-04-10T10:01:00.000Z"),
      };

      await expect(
        upsertReminderExecutions(tx as never, [newerQueuedSnapshot]),
      ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
      expect(tx.reminderExecution.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["rule", { ruleId: USER_ID }],
    ["recipient", { recipientEmail: "other@example.test" }],
    ["payload", { queuePayload: { ...queuePayload, leadName: "Other" } }],
  ] as const)("rejects a live %s identity conflict", async (_label, change) => {
    const tx = executionRestoreTx([{ ...liveExecution("pending"), ...change }]);

    await expect(
      upsertReminderExecutions(tx as never, [recoveryExecution]),
    ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
  });

  it("rejects a dedupe key already owned by another execution id", async () => {
    const tx = executionRestoreTx([
      {
        ...liveExecution("sent"),
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      },
    ]);

    await expect(
      upsertReminderExecutions(tx as never, [recoveryExecution]),
    ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
  });
});

describe("upsertReminderRules — retained execution compatibility", () => {
  it("rejects an identity-changing rule update with retained executions", async () => {
    const rule = {
      id: recoveryExecution.ruleId,
      reportId: recoveryExecution.reportId,
      policyId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      kind: "deadline" as const,
      fireAt: recoveryExecution.scheduledFor,
      deadline: recoveryExecution.scheduledFor,
      timezone: "Europe/Moscow",
      status: "active" as const,
      version: 1,
    };
    const tx = {
      reminderRule: { create: vi.fn(), update: vi.fn() },
    };

    await expect(
      upsertReminderRules(
        tx as never,
        [{ ...rule, fireAt: new Date(0) }],
        [{ ...rule, _count: { executions: 1 } }],
      ),
    ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
    expect(tx.reminderRule.update).not.toHaveBeenCalled();
  });
});

describe("upsertReminderPolicies — retained rule consistency", () => {
  it("pauses every retained live rule even when the rule is omitted from the snapshot", async () => {
    const tx = {
      reminderPolicy: { upsert: vi.fn().mockResolvedValue(undefined) },
      reminderRule: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const policy = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      kind: "deadline" as const,
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft" as const,
      active: false,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    };

    await upsertReminderPolicies(tx as never, [policy]);

    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { policyId: policy.id },
      data: { status: "paused" },
    });
  });

  it("does not reactivate historical rules when an active policy is restored", async () => {
    const tx = {
      reminderPolicy: { upsert: vi.fn().mockResolvedValue(undefined) },
      reminderRule: { updateMany: vi.fn() },
    };
    const policy = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      kind: "deadline" as const,
      offsetMinutes: 0,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft" as const,
      active: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    };

    await upsertReminderPolicies(tx as never, [policy]);

    expect(tx.reminderRule.updateMany).not.toHaveBeenCalled();
  });
});

describe("reconcileRestoredReminderRuleStatuses — additive restore", () => {
  const policy = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    kind: "deadline" as const,
    offsetMinutes: 0,
    timezone: "Europe/Moscow",
    audience: "lead-with-draft" as const,
    active: true,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: null,
  };
  const currentDeadline = new Date("2026-04-11T09:00:00.000Z");
  const report = {
    deadline: currentDeadline,
    status: "draft",
    periodState: "open",
    periodStatus: "open",
    archived: false,
  };

  it("pauses an active superseded version without changing the latest rule", async () => {
    const historicalRuleId = "10000000-0000-4000-8000-000000000001";
    const rules = [
      {
        id: historicalRuleId,
        reportId: recoveryExecution.reportId,
        policyId: policy.id,
        kind: policy.kind,
        fireAt: new Date("2026-04-10T09:00:00.000Z"),
        deadline: new Date("2026-04-10T09:00:00.000Z"),
        timezone: policy.timezone,
        status: "active",
        version: 1,
        report,
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        reportId: recoveryExecution.reportId,
        policyId: policy.id,
        kind: policy.kind,
        fireAt: currentDeadline,
        deadline: currentDeadline,
        timezone: policy.timezone,
        status: "active",
        version: 2,
        report,
      },
    ];
    const tx = {
      reminderRule: {
        findMany: vi.fn().mockResolvedValue(rules),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await reconcileRestoredReminderRuleStatuses(tx as never, [policy]);

    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [historicalRuleId] }, status: "active" },
      data: { status: "paused" },
    });
  });

  it("pauses an omitted retained latest rule whose identity is stale", async () => {
    const staleRule = {
      id: recoveryExecution.ruleId,
      reportId: recoveryExecution.reportId,
      policyId: policy.id,
      kind: policy.kind,
      fireAt: new Date("2026-04-10T09:00:00.000Z"),
      deadline: new Date("2026-04-10T09:00:00.000Z"),
      timezone: policy.timezone,
      status: "active",
      version: 1,
      report,
    };
    const tx = {
      reminderRule: {
        findMany: vi.fn().mockResolvedValue([staleRule]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await reconcileRestoredReminderRuleStatuses(tx as never, [policy]);

    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [staleRule.id] }, status: "active" },
      data: { status: "paused" },
    });
  });

  it("pauses a stale target-only rule retained on a restored report", async () => {
    const targetOnlyPolicyId = "10000000-0000-4000-8000-000000000016";
    const staleRule = {
      id: "10000000-0000-4000-8000-000000000017",
      reportId: recoveryExecution.reportId,
      policyId: targetOnlyPolicyId,
      kind: policy.kind,
      fireAt: new Date("2026-04-10T09:00:00.000Z"),
      deadline: new Date("2026-04-10T09:00:00.000Z"),
      timezone: policy.timezone,
      status: "active",
      version: 1,
      report: { ...report, deadline: currentDeadline },
      policy: {
        kind: policy.kind,
        offsetMinutes: policy.offsetMinutes,
        timezone: policy.timezone,
        active: true,
        validFrom: policy.validFrom,
        validUntil: policy.validUntil,
      },
    };
    const tx = {
      reminderRule: {
        findMany: vi.fn().mockResolvedValue([staleRule]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await reconcileRestoredReminderRuleStatuses(tx as never, [], [REPORT_ID]);

    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [staleRule.id] }, status: "active" },
      data: { status: "paused" },
    });
  });
});

describe("writePeriodRow — publication recovery", () => {
  it("writes the validated immutable snapshot with the restored lifecycle", async () => {
    const report = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn(),
    };
    const snapshot = {
      reportId: "55555555-5555-4555-8555-555555555555",
      periodStart: new Date("2026-04-13T00:00:00.000Z"),
      periodEnd: new Date("2026-04-19T23:59:59.000Z"),
      deadline: null,
      status: "published",
      publishedAt: new Date("2026-04-19T15:00:00.000Z"),
      publishedById: null,
      publishedByName: null,
      portfolioOverview: {
        status: "green",
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections: [],
    } as const;

    await writePeriodRow({ report } as never, {
      id: snapshot.reportId,
      periodStart: new Date("2026-04-13T00:00:00.000Z"),
      periodEnd: new Date("2026-04-19T23:59:59.000Z"),
      deadline: null,
      weekLabel: "Apr 13–19",
      status: "published",
      periodState: "published",
      periodStatus: "published",
      archived: false,
      autoPublished: false,
      autoArchived: false,
      publishedAt: new Date("2026-04-19T15:00:00.000Z"),
      publishedById: null,
      reopenedAt: null,
      publishedSnapshot: snapshot,
    });

    const snapshotMatcher: unknown = expect.objectContaining({
      reportId: snapshot.reportId,
      status: "published",
    });
    const dataMatcher: unknown = expect.objectContaining({
      publishedSnapshot: snapshotMatcher,
      weekLabel: "Apr 13–19",
    });
    const createMatcher: unknown = expect.objectContaining({
      data: dataMatcher,
    });
    expect(report.create).toHaveBeenCalledWith(createMatcher);
  });
});
