import type { ReminderPolicy } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { saveReminderPolicy } from "./admin-reminder-policy.queries.js";

const policy: ReminderPolicy = {
  id: "c1111111-1111-4111-8111-111111111111",
  kind: "deadline",
  offsetMinutes: -180,
  timezone: "Europe/Moscow",
  audience: "lead-with-draft",
  active: false,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: null,
};
const savedRow = {
  ...policy,
  audience: "LEAD_WITH_DRAFT" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const asNever = (value: unknown): never => value as never;

function sqlText(query: unknown): string {
  if (Array.isArray(query)) return query.join("?");
  if (
    typeof query === "object" &&
    query !== null &&
    "strings" in query &&
    Array.isArray(query.strings)
  ) {
    return query.strings.join("?");
  }
  throw new Error("Expected a Prisma SQL template");
}

function makeTransaction(input?: {
  saved?: typeof savedRow;
  reports?: readonly {
    id: string;
    deadline: Date;
    periodState: "scheduled" | "open";
    status: "draft";
    periodStatus: "open";
    archived: false;
  }[];
  currentRule?: object | null;
}) {
  const saved = input?.saved ?? savedRow;
  const reports = input?.reports ?? [];
  const $queryRaw = vi.fn((query: unknown): unknown[] => {
    const sql = sqlText(query);
    if (sql.includes('FROM "ReminderPolicy"')) return [saved];
    if (sql.includes('FROM "Report"')) return [...reports];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const tx = {
    $queryRaw,
    reminderPolicy: { upsert: vi.fn().mockResolvedValue(saved) },
    reminderRule: {
      findFirst: vi.fn().mockResolvedValue(input?.currentRule ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "rule-v1" }),
    },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return { prisma, tx };
}

describe("saveReminderPolicy transaction", () => {
  it("commits policy deactivation and pauses all live rule versions atomically", async () => {
    const { prisma, tx } = makeTransaction();

    await expect(saveReminderPolicy(asNever(prisma), policy)).resolves.toEqual(
      policy,
    );

    expect(tx.reminderPolicy.upsert).toHaveBeenCalledOnce();
    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { policyId: policy.id, status: "active" },
      data: { status: "paused" },
    });
    expect(tx.reminderRule.create).not.toHaveBeenCalled();
  });

  it("reconciles a scheduled report when a new active policy is saved", async () => {
    const deadline = new Date("2026-06-01T18:00:00.000Z");
    const active = { ...savedRow, active: true };
    const { prisma, tx } = makeTransaction({
      saved: active,
      reports: [
        {
          id: "report-scheduled",
          deadline,
          periodState: "scheduled",
          status: "draft",
          periodStatus: "open",
          archived: false,
        },
      ],
    });

    await saveReminderPolicy(
      asNever(prisma),
      { ...policy, active: true },
      new Date("2026-05-01T00:00:00.000Z"),
    );

    const createArgs = tx.reminderRule.create.mock.calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId: "report-scheduled",
      policyId: policy.id,
      deadline,
      status: "active",
      version: 1,
    });
  });

  it("rejects the whole save when the derived-status cascade fails", async () => {
    const { prisma, tx } = makeTransaction();
    tx.reminderRule.updateMany.mockRejectedValue(new Error("cascade failed"));

    await expect(saveReminderPolicy(asNever(prisma), policy)).rejects.toThrow(
      "cascade failed",
    );
  });
});
