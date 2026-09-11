import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { updatePeriodManual } from "./manual-update.js";

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

describe("updatePeriodManual reminder reconciliation", () => {
  it("locks policies before the Report and versions an executed schedule atomically", async () => {
    const reportId = "f0000000-0000-4000-a000-0000000000d1";
    const oldDeadline = new Date("2026-09-02T18:00:00.000Z");
    const newDeadline = new Date("2026-09-03T18:00:00.000Z");
    const now = new Date("2026-09-01T00:00:00.000Z");
    const lifecycle = {
      status: "draft" as const,
      periodState: "open" as const,
      periodStatus: "open" as const,
      archived: false,
      autoPublished: false,
      autoArchived: false,
      publishedAt: null,
      publishedById: null,
      reopenedAt: null,
    };
    const policy = {
      id: "policy-1",
      kind: "deadline" as const,
      offsetMinutes: -180,
      timezone: "Europe/Moscow",
      audience: "LEAD_WITH_DRAFT" as const,
      active: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const sql: string[] = [];
    const $queryRaw = vi.fn((query: unknown) => {
      const statement = sqlText(query);
      sql.push(statement);
      return statement.includes('FROM "ReminderPolicy"')
        ? [policy]
        : [lifecycle];
    });
    const reminderRule = {
      findFirst: vi.fn().mockResolvedValue({
        id: "rule-v1",
        reportId,
        policyId: policy.id,
        kind: policy.kind,
        fireAt: new Date(oldDeadline.getTime() + policy.offsetMinutes * 60_000),
        deadline: oldDeadline,
        timezone: policy.timezone,
        status: "active",
        version: 1,
        _count: { executions: 1 },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "rule-v2" }),
    };
    const report = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: reportId,
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T23:59:59.999Z"),
        deadline: newDeadline,
        weekLabel: "Aug 31–Sep 6, 2026",
        ...lifecycle,
      }),
    };
    const $executeRaw = vi.fn().mockResolvedValue(0);
    const tx = { $executeRaw, $queryRaw, report, reminderRule };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      updatePeriodManual(
        prisma,
        {
          reportId,
          expectedPeriodState: "open",
          data: { deadline: newDeadline },
        },
        now,
      ),
    ).resolves.toMatchObject({ deadline: newDeadline });

    expect($executeRaw).toHaveBeenCalledOnce();
    expect($executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      expectDefined($queryRaw.mock.invocationCallOrder[0]),
    );
    expect($executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      expectDefined(report.updateMany.mock.invocationCallOrder[0]),
    );
    expect(sql[0]).toContain('FROM "ReminderPolicy"');
    expect(sql[1]).toContain('FROM "Report"');
    expect(reminderRule.update).toHaveBeenCalledWith({
      where: { id: "rule-v1" },
      data: { status: "paused" },
    });
    const createArgs = reminderRule.create.mock.calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId,
      policyId: policy.id,
      deadline: newDeadline,
      version: 2,
    });
  });
});
