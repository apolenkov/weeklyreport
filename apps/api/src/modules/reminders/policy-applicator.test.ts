import { describe, expect, it, vi } from "vitest";

import { PolicyApplicatorService } from "./policy-applicator.service";

/* ------------------------------------------------------------------ */
/*  Validity gate (pure)                                               */
/* ------------------------------------------------------------------ */

describe("PolicyApplicatorService.policyAppliesTo — validity gate", () => {
  const validFrom = new Date("2026-05-01T00:00:00.000Z");
  const validUntil = new Date("2026-08-01T00:00:00.000Z");

  it.each([
    {
      label: "active and deadline inside [validFrom, validUntil]",
      policy: { active: true, validFrom, validUntil },
      deadline: new Date("2026-06-15T18:00:00.000Z"),
      expected: true,
    },
    {
      label: "policy.active is false",
      policy: { active: false, validFrom, validUntil },
      deadline: new Date("2026-06-15T18:00:00.000Z"),
      expected: false,
    },
    {
      label: "deadline is before validFrom",
      policy: { active: true, validFrom, validUntil },
      deadline: new Date("2026-04-15T18:00:00.000Z"),
      expected: false,
    },
    {
      label: "deadline is after validUntil",
      policy: { active: true, validFrom, validUntil },
      deadline: new Date("2026-09-15T18:00:00.000Z"),
      expected: false,
    },
    {
      label: "validUntil is null (forever-policy)",
      policy: { active: true, validFrom, validUntil: null },
      deadline: new Date("2030-01-01T00:00:00.000Z"),
      expected: true,
    },
  ] as const)(
    "returns $expected when $label",
    ({ policy, deadline, expected }) => {
      expect(
        PolicyApplicatorService.policyAppliesTo(policy, { deadline }),
      ).toBe(expected);
    },
  );

  it("boundary: deadline === validFrom is INSIDE the window", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: true, validFrom, validUntil },
      { deadline: new Date("2026-05-01T00:00:00.000Z") },
    );
    expect(result).toBe(true);
  });

  it("boundary: deadline === validUntil is INSIDE the window", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: true, validFrom, validUntil },
      { deadline: new Date("2026-08-01T00:00:00.000Z") },
    );
    expect(result).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  computeFireAt — DST-correct math                                   */
/* ------------------------------------------------------------------ */

describe("PolicyApplicatorService.computeFireAt — DST-correct math", () => {
  const fakePrisma = {} as never;

  it("subtracts 24h in Europe/Moscow (no DST — fixed UTC+3)", () => {
    const svc = new PolicyApplicatorService(fakePrisma);
    // Deadline: 2026-06-01 21:00 MSK = 18:00 UTC
    const deadline = new Date("2026-06-01T18:00:00.000Z");
    const fireAt = svc.computeFireAt(deadline, -24 * 60, "Europe/Moscow");
    // T-24h: 2026-05-31 21:00 MSK = 18:00 UTC
    expect(fireAt.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  it("handles DST forward in America/New_York (clocks +1h)", () => {
    const svc = new PolicyApplicatorService(fakePrisma);
    // Deadline: 2026-03-09 09:00 EDT = 13:00 UTC (after DST jump)
    const deadline = new Date("2026-03-09T13:00:00.000Z");
    // T-24h in wall-clock should be 2026-03-08 09:00 EST = 14:00 UTC
    // (because NY was still on EST then). Luxon's DateTime arithmetic
    // gives exact-24h elapsed, which means 2026-03-08 13:00 UTC.
    const fireAt = svc.computeFireAt(deadline, -24 * 60, "America/New_York");
    expect(fireAt.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });
});

/* ------------------------------------------------------------------ */
/*  applyToPeriod — orchestration with stubbed Prisma                  */
/* ------------------------------------------------------------------ */

interface StubPolicy {
  id: string;
  active: boolean;
  validFrom: Date;
  validUntil: Date | null;
  offsetMinutes: number;
  timezone: string;
  kind: "deadline" | "follow_up" | "escalation";
}

function makeStubPrisma(policies: StubPolicy[], existingRules: Set<string>) {
  const upsertCalls: {
    where: unknown;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }[] = [];

  return {
    upsertCalls,
    prisma: {
      reminderPolicy: {
        // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements async prisma findMany (returns synchronously in test)
        findMany: vi.fn(async () => policies.filter((p) => p.active)),
      },
      reminderRule: {
        findUnique: vi.fn(
          async (args: {
            where: {
              reportId_policyId: { reportId: string; policyId: string };
            };
            // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements async prisma findUnique method (no awaitable work in the stub)
          }) => {
            const key = `${args.where.reportId_policyId.reportId}:${args.where.reportId_policyId.policyId}`;
            return existingRules.has(key) ? { id: "existing" } : null;
          },
        ),
        upsert: vi.fn(
          async (args: {
            where: unknown;
            create: Record<string, unknown>;
            update: Record<string, unknown>;
            // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements async prisma upsert method (no awaitable work in the stub)
          }) => {
            upsertCalls.push(args);
            return { id: "rule-id" };
          },
        ),
      },
    } as never,
  };
}

describe("PolicyApplicatorService.applyToPeriod", () => {
  const validFrom = new Date("2026-01-01T00:00:00.000Z");
  const validUntil = new Date("2026-12-31T00:00:00.000Z");

  const policyA: StubPolicy = {
    id: "policy-a",
    active: true,
    validFrom,
    validUntil,
    offsetMinutes: -1440,
    timezone: "Europe/Moscow",
    kind: "deadline",
  };

  const policyB: StubPolicy = {
    id: "policy-b",
    active: true,
    validFrom: new Date("2027-01-01T00:00:00.000Z"),
    validUntil: null,
    offsetMinutes: -1440,
    timezone: "Europe/Moscow",
    kind: "deadline",
  };

  const policyInactive: StubPolicy = {
    ...policyA,
    id: "policy-inactive",
    active: false,
  };

  it("creates one rule per applicable active policy", async () => {
    const period = {
      id: "report-1",
      deadline: new Date("2026-06-01T18:00:00.000Z"),
    };
    const stub = makeStubPrisma([policyA, policyB, policyInactive], new Set());
    const svc = new PolicyApplicatorService(stub.prisma);

    const result = await svc.applyToPeriod(period);

    // policyA: in-window → upsert
    // policyB: validFrom in 2027 → skip
    // policyInactive: filtered by findMany WHERE active:true → not seen
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1); // policyB
    expect(stub.upsertCalls).toHaveLength(1);
    expect(stub.upsertCalls[0]?.create).toMatchObject({
      reportId: "report-1",
      policyId: "policy-a",
      kind: "deadline",
      timezone: "Europe/Moscow",
      status: "active",
    });
  });

  it("is idempotent: second call updates instead of creating", async () => {
    const period = {
      id: "report-1",
      deadline: new Date("2026-06-01T18:00:00.000Z"),
    };
    const existing = new Set<string>(["report-1:policy-a"]);
    const stub = makeStubPrisma([policyA], existing);
    const svc = new PolicyApplicatorService(stub.prisma);

    const result = await svc.applyToPeriod(period);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(stub.upsertCalls).toHaveLength(1);
  });

  it("skips policy whose validUntil predates the deadline", async () => {
    const period = {
      id: "report-1",
      deadline: new Date("2027-01-01T18:00:00.000Z"),
    };
    const stub = makeStubPrisma([policyA], new Set());
    const svc = new PolicyApplicatorService(stub.prisma);

    const result = await svc.applyToPeriod(period);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(stub.upsertCalls).toHaveLength(0);
  });

  it("when `now` is given, skips an elapsed instant but keeps a still-future one", async () => {
    // Period created late: now sits AFTER the T-24h deadline reminder fired but
    // BEFORE the T+2h escalation. The elapsed deadline rule must be skipped (it
    // would fire stale), the future escalation must still be materialised.
    const deadline = new Date("2026-06-01T18:00:00.000Z");
    const now = new Date("2026-06-01T19:00:00.000Z");
    const policyEscalation: StubPolicy = {
      ...policyA,
      id: "policy-escalation",
      offsetMinutes: 120, // T+2h → fireAt 20:00Z, still future at now=19:00Z
      kind: "escalation",
    };
    const stub = makeStubPrisma([policyA, policyEscalation], new Set());
    const svc = new PolicyApplicatorService(stub.prisma);

    const result = await svc.applyToPeriod({ id: "report-1", deadline }, now);

    // policyA (T-24h, fireAt 2026-05-31) is elapsed → skipped; escalation kept.
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(stub.upsertCalls).toHaveLength(1);
    expect(stub.upsertCalls[0]?.create).toMatchObject({
      policyId: "policy-escalation",
    });
  });

  it("without `now`, materialises even an already-past instant (backfill/snapshot path)", async () => {
    // Callers that omit `now` — snapshot-restore and the reminder-policy
    // backfill — reinstate rules verbatim, so the elapsed-skip must not apply.
    // (The cron scheduler now routes through the period factory, which DOES
    // pass `now`, so it is not an omit-`now` caller.)
    const deadline = new Date("2026-06-01T18:00:00.000Z");
    const stub = makeStubPrisma([policyA], new Set());
    const svc = new PolicyApplicatorService(stub.prisma);

    const result = await svc.applyToPeriod({ id: "report-1", deadline });

    expect(result.created).toBe(1);
    expect(stub.upsertCalls).toHaveLength(1);
  });

  it("catches P2002 race and continues with the rest of the policies", async () => {
    const period = {
      id: "report-1",
      deadline: new Date("2026-06-01T18:00:00.000Z"),
    };
    const policyC: StubPolicy = {
      ...policyA,
      id: "policy-c",
      offsetMinutes: -120, // T-2h, distinct rule
    };

    // eslint-disable-next-line sonarjs/no-unused-collection -- test verifies result counts (created/skipped), not call history; sibling tests inspect upsertCalls
    const upsertCalls: unknown[] = [];
    let firstCall = true;
    const prisma = {
      reminderPolicy: {
        // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements async prisma findMany (returns synchronously in test)
        findMany: vi.fn(async () => [policyA, policyC]),
      },
      reminderRule: {
        // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements async prisma findUnique (returns synchronously in test)
        findUnique: vi.fn(async () => null),
        // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements the async prisma upsert method (throws or returns synchronously, no awaitable work)
        upsert: vi.fn(async (args: unknown) => {
          if (firstCall) {
            firstCall = false;
            const err = new Error("Unique constraint violation") as Error & {
              code?: string;
            };
            err.code = "P2002";
            throw err;
          }
          upsertCalls.push(args);
          return { id: "rule-id" };
        }),
      },
    } as never;
    const svc = new PolicyApplicatorService(prisma);

    const result = await svc.applyToPeriod(period);

    // policyA: P2002 → skipped
    // policyC: success → created
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("re-throws an unexpected Prisma error and aborts later policies", async () => {
    const unexpectedError = new Error("Database connection lost");
    const policyC: StubPolicy = { ...policyA, id: "policy-c" };
    const upsert = vi.fn().mockRejectedValue(unexpectedError);
    const prisma = {
      reminderPolicy: {
        findMany: vi.fn().mockResolvedValue([policyA, policyC]),
      },
      reminderRule: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    } as never;
    const svc = new PolicyApplicatorService(prisma);

    await expect(
      svc.applyToPeriod({
        id: "report-1",
        deadline: new Date("2026-06-01T18:00:00.000Z"),
      }),
    ).rejects.toBe(unexpectedError);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
