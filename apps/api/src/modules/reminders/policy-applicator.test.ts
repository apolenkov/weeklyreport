import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "@customreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { PolicyApplicatorService } from "./policy-applicator.service";

describe("reminderPolicyAppliesTo", () => {
  const validFrom = new Date("2026-05-01T00:00:00.000Z");
  const validUntil = new Date("2026-08-01T00:00:00.000Z");

  it.each([
    [true, validFrom, validUntil, new Date("2026-06-15T18:00:00.000Z"), true],
    [false, validFrom, validUntil, new Date("2026-06-15T18:00:00.000Z"), false],
    [true, validFrom, validUntil, new Date("2026-04-15T18:00:00.000Z"), false],
    [true, validFrom, validUntil, new Date("2026-09-15T18:00:00.000Z"), false],
    [true, validFrom, null, new Date("2030-01-01T00:00:00.000Z"), true],
  ] as const)(
    "checks active=%s and the inclusive validity window",
    (active, from, until, deadline, expected) => {
      expect(
        reminderPolicyAppliesTo(
          { active, validFrom: from, validUntil: until },
          deadline,
        ),
      ).toBe(expected);
    },
  );

  it("includes both validity boundaries", () => {
    const policy = { active: true, validFrom, validUntil };
    expect(reminderPolicyAppliesTo(policy, validFrom)).toBe(true);
    expect(reminderPolicyAppliesTo(policy, validUntil)).toBe(true);
  });
});

describe("computeReminderFireAt", () => {
  it("applies elapsed minutes across timezones", () => {
    const deadline = new Date("2026-03-09T13:00:00.000Z");
    expect(
      computeReminderFireAt(
        deadline,
        -24 * 60,
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-03-08T13:00:00.000Z");
  });
});

const DEADLINE = new Date("2026-06-01T18:00:00.000Z");
const POLICY = {
  id: "policy-a",
  active: true,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2026-12-31T00:00:00.000Z"),
  offsetMinutes: -1440,
  timezone: "Europe/Moscow",
  audience: "lead_with_draft" as const,
  kind: "deadline" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};
interface LockedReportRow {
  readonly id: string;
  readonly deadline: Date | null;
  readonly periodState: "scheduled" | "open" | "published" | "archived";
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
  readonly archived: boolean;
}
const REPORT = {
  id: "report-1",
  deadline: DEADLINE,
  periodState: "open" as const,
  status: "draft" as const,
  periodStatus: "open" as const,
  archived: false,
} satisfies LockedReportRow;

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

function makePrisma(input?: {
  policies?: readonly (typeof POLICY)[];
  report?: LockedReportRow | null;
  current?: {
    id: string;
    reportId: string;
    policyId: string;
    kind: "deadline" | "escalation";
    fireAt: Date;
    deadline: Date;
    timezone: string;
    status: "active" | "paused";
    version: number;
    _count: { executions: number };
  } | null;
}) {
  const policies = input?.policies ?? [POLICY];
  const report = input?.report === undefined ? REPORT : input.report;
  const sql: string[] = [];
  const $queryRaw = vi.fn((query: unknown): unknown[] => {
    const statement = sqlText(query);
    sql.push(statement);
    if (statement.includes('FROM "ReminderPolicy"')) return [...policies];
    if (statement.includes('FROM "Report"')) return report ? [report] : [];
    throw new Error(`Unexpected SQL: ${statement}`);
  });
  const reminderRule = {
    findFirst: vi.fn().mockResolvedValue(input?.current ?? null),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: "rule-created" }),
  };
  const tx = { $queryRaw, reminderRule };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { prisma, reminderRule, sql };
}

describe("PolicyApplicatorService", () => {
  it("locks policies before the Report and creates from the persisted deadline", async () => {
    const stub = makePrisma();

    await expect(
      new PolicyApplicatorService(stub.prisma).applyToPeriod("report-1"),
    ).resolves.toEqual({ created: 1, updated: 0, skipped: 0 });

    expect(stub.sql[0]).toContain('FROM "ReminderPolicy"');
    expect(stub.sql[1]).toContain('FROM "Report"');
    const createArgs = stub.reminderRule.create.mock
      .calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId: "report-1",
      policyId: POLICY.id,
      deadline: DEADLINE,
      fireAt: computeReminderFireAt(
        DEADLINE,
        POLICY.offsetMinutes,
        POLICY.timezone,
      ),
      version: 1,
    });
  });

  it("updates an unexecuted rule in place when its schedule identity changes", async () => {
    const current = {
      id: "rule-v1",
      reportId: REPORT.id,
      policyId: POLICY.id,
      kind: "deadline" as const,
      fireAt: new Date("2026-05-20T18:00:00.000Z"),
      deadline: new Date("2026-05-21T18:00:00.000Z"),
      timezone: POLICY.timezone,
      status: "active" as const,
      version: 1,
      _count: { executions: 0 },
    };
    const stub = makePrisma({ current });

    await expect(
      new PolicyApplicatorService(stub.prisma).applyToPeriod("report-1"),
    ).resolves.toEqual({ created: 0, updated: 1, skipped: 0 });

    const updateArgs = stub.reminderRule.update.mock
      .calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
      where: Record<string, unknown>;
    };
    expect(updateArgs).toMatchObject({
      where: { id: "rule-v1" },
      data: { deadline: DEADLINE, status: "active" },
    });
    expect(stub.reminderRule.create).not.toHaveBeenCalled();
  });

  it("versions an executed rule instead of rewriting immutable execution facts", async () => {
    const oldDeadline = new Date("2026-05-21T18:00:00.000Z");
    const current = {
      id: "rule-v1",
      reportId: REPORT.id,
      policyId: POLICY.id,
      kind: "deadline" as const,
      fireAt: computeReminderFireAt(
        oldDeadline,
        POLICY.offsetMinutes,
        POLICY.timezone,
      ),
      deadline: oldDeadline,
      timezone: POLICY.timezone,
      status: "active" as const,
      version: 1,
      _count: { executions: 1 },
    };
    const stub = makePrisma({ current });

    await expect(
      new PolicyApplicatorService(stub.prisma).applyToPeriod("report-1"),
    ).resolves.toEqual({ created: 1, updated: 0, skipped: 0 });

    expect(stub.reminderRule.update).toHaveBeenCalledWith({
      where: { id: "rule-v1" },
      data: { status: "paused" },
    });
    const createArgs = stub.reminderRule.create.mock
      .calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId: REPORT.id,
      policyId: POLICY.id,
      deadline: DEADLINE,
      version: 2,
    });
  });

  it("does not revive a rule when deactivation wins before the locked read", async () => {
    const stub = makePrisma({
      policies: [{ ...POLICY, active: false }],
      current: {
        id: "rule-v1",
        reportId: REPORT.id,
        policyId: POLICY.id,
        kind: POLICY.kind,
        fireAt: computeReminderFireAt(
          DEADLINE,
          POLICY.offsetMinutes,
          POLICY.timezone,
        ),
        deadline: DEADLINE,
        timezone: POLICY.timezone,
        status: "paused",
        version: 1,
        _count: { executions: 0 },
      },
    });

    await expect(
      new PolicyApplicatorService(stub.prisma).applyToPeriod("report-1"),
    ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(stub.reminderRule.create).not.toHaveBeenCalled();
    expect(stub.reminderRule.update).not.toHaveBeenCalled();
  });

  it("pauses a rule for a contradictory open lifecycle tuple", async () => {
    const current = {
      id: "rule-v1",
      reportId: REPORT.id,
      policyId: POLICY.id,
      kind: POLICY.kind,
      fireAt: computeReminderFireAt(
        DEADLINE,
        POLICY.offsetMinutes,
        POLICY.timezone,
      ),
      deadline: DEADLINE,
      timezone: POLICY.timezone,
      status: "active" as const,
      version: 1,
      _count: { executions: 0 },
    };
    const stub = makePrisma({
      current,
      report: {
        ...REPORT,
        status: "published",
        periodStatus: "published",
      },
    });

    await expect(
      new PolicyApplicatorService(stub.prisma).applyToPeriod(REPORT.id),
    ).resolves.toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(stub.reminderRule.update).toHaveBeenCalledWith({
      where: { id: current.id },
      data: { status: "paused" },
    });
  });

  it("skips an excluded restored policy and a missing Report", async () => {
    const excluded = makePrisma();
    await expect(
      new PolicyApplicatorService(excluded.prisma).applyToPeriod(
        "report-1",
        undefined,
        new Set([POLICY.id]),
      ),
    ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(excluded.reminderRule.findFirst).not.toHaveBeenCalled();

    const missing = makePrisma({ report: null });
    await expect(
      new PolicyApplicatorService(missing.prisma).repairToPeriod("missing"),
    ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
  });
});

describe("missing reminder recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T18:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("creates a missing future rule from the locked Report and skips it on retry", async () => {
    const stub = makePrisma();
    const service = new PolicyApplicatorService(stub.prisma);
    await expect(service.repairToPeriod(REPORT.id)).resolves.toEqual({
      created: 1,
      skipped: 0,
      updated: 0,
    });
    expect(stub.sql[0]).toContain('FROM "ReminderPolicy"');
    expect(stub.sql[1]).toContain('FROM "Report"');
    expect(stub.reminderRule.create).toHaveBeenCalledWith({
      data: {
        reportId: REPORT.id,
        policyId: POLICY.id,
        kind: POLICY.kind,
        deadline: DEADLINE,
        fireAt: new Date("2026-05-31T18:00:00.000Z"),
        timezone: POLICY.timezone,
        status: "active",
        version: 1,
      },
    });
    stub.reminderRule.findFirst.mockResolvedValue({ id: "rule-created" });
    await expect(service.repairToPeriod(REPORT.id)).resolves.toEqual({
      created: 0,
      skipped: 1,
      updated: 0,
    });
    expect(stub.reminderRule.create).toHaveBeenCalledTimes(1);
  });

  it.each(["active", "paused"] as const)(
    "preserves an existing %s version with a stale schedule",
    async (status) => {
      const stub = makePrisma({
        current: {
          id: "restored",
          reportId: REPORT.id,
          policyId: POLICY.id,
          kind: POLICY.kind,
          fireAt: new Date("2026-05-01T00:00:00.000Z"),
          deadline: DEADLINE,
          timezone: "UTC",
          status,
          version: 4,
          _count: { executions: 1 },
        },
      });
      await expect(
        new PolicyApplicatorService(stub.prisma).repairToPeriod(REPORT.id),
      ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
      expect(stub.reminderRule.update).not.toHaveBeenCalled();
      expect(stub.reminderRule.updateMany).not.toHaveBeenCalled();
      expect(stub.reminderRule.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { report: { ...REPORT, archived: true } },
    { report: { ...REPORT, periodState: "published" as const } },
    {
      report: {
        ...REPORT,
        status: "published" as const,
        periodStatus: "published" as const,
      },
    },
    { report: { ...REPORT, deadline: null } },
    { policies: [{ ...POLICY, active: false }] },
    {
      policies: [
        { ...POLICY, validUntil: new Date("2026-05-31T00:00:00.000Z") },
      ],
    },
  ])("skips an inapplicable locked state: %j", async (input) => {
    const stub = makePrisma(input);
    await expect(
      new PolicyApplicatorService(stub.prisma).repairToPeriod(REPORT.id),
    ).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(stub.reminderRule.create).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    "skips a fire time reached during the existence query (%s ms later)",
    async (elapsedMs) => {
      const stub = makePrisma();
      stub.reminderRule.findFirst.mockImplementation(() => {
        vi.setSystemTime(
          new Date(new Date("2026-05-31T18:00:00.000Z").getTime() + elapsedMs),
        );
        return Promise.resolve(null);
      });
      await new PolicyApplicatorService(stub.prisma).repairToPeriod(REPORT.id);
      expect(stub.reminderRule.create).not.toHaveBeenCalled();
    },
  );

  it("allows future positive offsets after a historical deadline", async () => {
    vi.setSystemTime(new Date("2026-06-02T00:00:00.000Z"));
    const stub = makePrisma({ policies: [{ ...POLICY, offsetMinutes: 1440 }] });
    await expect(
      new PolicyApplicatorService(stub.prisma).repairToPeriod(REPORT.id),
    ).resolves.toEqual({ created: 1, updated: 0, skipped: 0 });
  });
});
