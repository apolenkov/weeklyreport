import type { AdminReminderExecution } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { ReminderExecutionIneligibleError } from "./reminders.errors.js";
import {
  insertExecutionOnConflict,
  markExecutionFailed,
  markStuckSendingUncertain,
  transitionExecutionToSending,
  UNCERTAIN_DELIVERY_ERROR,
} from "./reminders-execution.prisma-query.js";
import type { ReminderQueuePayload } from "./reminders-queue-payload.js";

const execution: AdminReminderExecution = {
  id: "20000000-0000-4000-8000-000000000001",
  ruleId: "20000000-0000-4000-8000-000000000002",
  reportId: "20000000-0000-4000-8000-000000000003",
  dedupeKey: "atomic-report-lifecycle",
  status: "queued",
  scheduledFor: new Date("2026-04-07T09:00:00.000Z"),
  sentAt: null,
  recipientEmail: "lead@test.local",
  errorMessage: null,
};

const queuePayload: ReminderQueuePayload = {
  contractVersion: 1,
  kind: "deadline",
  cycleDate: "2026-04-07",
  leadName: "Test Lead",
  reportPeriod: "2026-04-07 → 2026-04-13",
  deadlineIso: "2026-04-13T18:00:00.000Z",
  sectionUrl: `https://example.test/lead/report/${execution.reportId}`,
  organization: {
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
  },
};

const asNever = (value: unknown): never => value as never;

describe("insertExecutionOnConflict editable-report lock", () => {
  it("persists nothing when publication wins before the locked eligibility check", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ active: true }])
      .mockResolvedValueOnce([]);
    const createMany = vi.fn();
    const findUnique = vi.fn();
    const updateMany = vi.fn();
    const transactionClient = {
      $queryRaw: queryRaw,
      reminderRule: {
        findUnique: vi.fn().mockResolvedValue({ policyId: "policy-1" }),
      },
      reminderExecution: { createMany, findUnique, updateMany },
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    await expect(
      insertExecutionOnConflict(asNever(prisma), execution, queuePayload),
    ).rejects.toBeInstanceOf(ReminderExecutionIneligibleError);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(createMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("revives a failed execution with the current payload under the same lifecycle lock", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ active: true }])
      .mockResolvedValueOnce([{ id: execution.ruleId }]);
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue({
      id: execution.id,
      ruleId: execution.ruleId,
      recipientEmail: execution.recipientEmail,
      dedupeKey: execution.dedupeKey,
      status: "failed",
      sentAt: null,
      error: "SMTP refused",
      createdAt: new Date("2026-04-07T09:01:00.000Z"),
      updatedAt: new Date("2026-04-07T09:02:00.000Z"),
      rule: {
        reportId: execution.reportId,
        fireAt: execution.scheduledFor,
      },
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      $queryRaw: queryRaw,
      reminderRule: {
        findUnique: vi.fn().mockResolvedValue({ policyId: "policy-1" }),
      },
      reminderExecution: { createMany, findUnique, updateMany },
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    await expect(
      insertExecutionOnConflict(asNever(prisma), execution, queuePayload, true),
    ).resolves.toMatchObject({
      outcome: "revived",
      execution: { id: execution.id, status: "queued", errorMessage: null },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: execution.id, status: "failed" },
      data: {
        status: "pending",
        error: null,
        queuePayload,
      },
    });
  });

  it("rejects a stale due payload after policy reconciliation changes the rule identity", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ active: true }])
      // The policy edit committed after due discovery. The locked SQL sees the
      // new rule kind/deadline/cycle and rejects the old payload atomically.
      .mockResolvedValueOnce([]);
    const createMany = vi.fn();
    const transactionClient = {
      $queryRaw: queryRaw,
      reminderRule: {
        findUnique: vi.fn().mockResolvedValue({ policyId: "policy-1" }),
      },
      reminderExecution: {
        createMany,
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    await expect(
      insertExecutionOnConflict(asNever(prisma), execution, queuePayload),
    ).rejects.toBeInstanceOf(ReminderExecutionIneligibleError);

    const eligibilityCall = queryRaw.mock.calls[1] ?? [];
    const template = eligibilityCall[0] as readonly string[];
    const sql = template.join("?");
    expect(sql).toContain('rule."kind" = ?::"ReminderRuleKind"');
    expect(sql).toContain('rule."policyId" = ?');
    expect(sql).toContain('rule."deadline" = ?');
    expect(sql).toContain('rule."fireAt"::date = ?::date');
    expect(sql).not.toContain("AT TIME ZONE");
    expect(sql).not.toContain("to_char(");
    expect(sql).toContain('policy."active" = true');
    expect(sql).toContain('report."deadline" = rule."deadline"');
    expect(eligibilityCall.slice(1)).toEqual(
      expect.arrayContaining([
        "policy-1",
        queuePayload.kind,
        new Date(queuePayload.deadlineIso),
        queuePayload.cycleDate,
      ]),
    );
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("markExecutionFailed canonical message", () => {
  it("normalizes a blank direct repository failure before persistence", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { reminderExecution: { updateMany } };

    await markExecutionFailed(asNever(prisma), execution.id, "  \t ");

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: execution.id,
        status: { in: ["pending", "sending"] },
      },
      data: { status: "failed", error: "Unknown error" },
    });
  });
});

describe("transitionExecutionToSending durable claim", () => {
  it("returns the validated DB recipient and payload from the winning CAS", async () => {
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          recipientEmail: "durable-recipient@test.local",
          queuePayload,
        },
      ]),
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    await expect(
      transitionExecutionToSending(asNever(prisma), execution.id),
    ).resolves.toEqual({
      recipientEmail: "durable-recipient@test.local",
      queuePayload,
    });
  });

  it("returns null when another worker already owns the execution", async () => {
    const transactionClient = { $queryRaw: vi.fn().mockResolvedValue([]) };
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    await expect(
      transitionExecutionToSending(asNever(prisma), execution.id),
    ).resolves.toBeNull();
  });

  it("rejects malformed durable payload inside the claim transaction", async () => {
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          recipientEmail: "durable-recipient@test.local",
          queuePayload: { contractVersion: 1, kind: "deadline" },
        },
      ]),
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    await expect(
      transitionExecutionToSending(asNever(prisma), execution.id),
    ).rejects.toThrow();
  });
});

// Crash-before-SMTP and crash-after-SMTP are indistinguishable without provider
// idempotency. Both become the same terminal, observable uncertain outcome.
describe("markStuckSendingUncertain", () => {
  it.each(["before SMTP", "after SMTP"])(
    "records unknown delivery after a worker crash %s",
    async () => {
      const prisma = {
        reminderExecution: {
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      };
      const cutoff = new Date("2026-04-11T11:30:00.000Z");

      const count = await markStuckSendingUncertain(asNever(prisma), cutoff);

      expect(count).toBe(3);
      expect(prisma.reminderExecution.updateMany.mock.calls).toMatchObject([
        [
          {
            where: { status: "sending", updatedAt: { lt: cutoff } },
            data: { status: "failed", error: UNCERTAIN_DELIVERY_ERROR },
          },
        ],
      ]);
    },
  );

  it("reports zero when no row is past the cutoff", async () => {
    const prisma = {
      reminderExecution: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const count = await markStuckSendingUncertain(
      asNever(prisma),
      new Date("2026-04-11T11:30:00.000Z"),
    );

    expect(count).toBe(0);
    expect(prisma.reminderExecution.updateMany).toHaveBeenCalledTimes(1);
  });
});
