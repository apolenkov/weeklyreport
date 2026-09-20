import { describe, expect, it, vi } from "vitest";

import {
  lockLiveReminderReports,
  reconcileLockedPolicyForReport,
} from "./reminder-rule-reconcile.prisma.js";

interface LockedReportRow {
  readonly id: string;
  readonly deadline: Date | null;
  readonly periodState: "scheduled" | "open" | "published" | "archived";
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
  readonly archived: boolean;
}

const DEADLINE = new Date("2026-06-01T18:00:00.000Z");
const POLICY = {
  id: "c1111111-1111-4111-8111-111111111111",
  kind: "deadline",
  offsetMinutes: -180,
  timezone: "Europe/Moscow",
  audience: "LEAD_WITH_DRAFT",
  active: true,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2026-12-31T23:59:59.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const LIVE_REPORT: LockedReportRow = {
  id: "report-open",
  deadline: DEADLINE,
  periodState: "open",
  status: "draft",
  periodStatus: "open",
  archived: false,
};

function asNever(value: unknown): never {
  return value as never;
}

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

function makeRuleTransaction(current: unknown = null) {
  return {
    reminderRule: {
      findFirst: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: "rule-v1" }),
    },
  };
}

describe("lockLiveReminderReports", () => {
  it("locks only the canonical scheduled/open/reopened live tuples", async () => {
    const rows: readonly LockedReportRow[] = [
      {
        ...LIVE_REPORT,
        id: "report-scheduled",
        periodState: "scheduled",
      },
      LIVE_REPORT,
      {
        ...LIVE_REPORT,
        id: "report-reopened",
        status: "published",
        periodStatus: "reopened",
      },
    ];
    const queryRaw = vi.fn().mockResolvedValue(rows);

    await expect(
      lockLiveReminderReports(asNever({ $queryRaw: queryRaw })),
    ).resolves.toEqual(rows);

    const sql = sqlText(queryRaw.mock.calls[0]?.[0]).replaceAll(/\s+/gu, " ");
    expect(sql).toContain('WHERE "archived" = false');
    expect(sql).toContain(
      "(\"periodState\" = 'scheduled' AND \"status\" = 'draft' AND \"periodStatus\" = 'open')",
    );
    expect(sql).toContain(
      "(\"periodState\" = 'open' AND \"status\" = 'draft' AND \"periodStatus\" = 'open')",
    );
    expect(sql).toContain(
      "(\"periodState\" = 'open' AND \"status\" = 'published' AND \"periodStatus\" = 'reopened')",
    );
    expect(sql).toContain('ORDER BY "id" FOR UPDATE');
  });
});

describe("reconcileLockedPolicyForReport", () => {
  it("skips without creating when no current rule is outside the policy window", async () => {
    const tx = makeRuleTransaction();
    const outOfWindowPolicy = {
      ...POLICY,
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
    };

    await expect(
      reconcileLockedPolicyForReport(
        asNever(tx),
        asNever(outOfWindowPolicy),
        LIVE_REPORT,
      ),
    ).resolves.toBe("skipped");

    expect(tx.reminderRule.findFirst).toHaveBeenCalledOnce();
    expect(tx.reminderRule.create).not.toHaveBeenCalled();
    expect(tx.reminderRule.update).not.toHaveBeenCalled();
    expect(tx.reminderRule.updateMany).not.toHaveBeenCalled();
  });
});
