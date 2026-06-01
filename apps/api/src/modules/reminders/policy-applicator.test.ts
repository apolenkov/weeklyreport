import { describe, expect, it, vi } from "vitest";

import { PolicyApplicatorService } from "./policy-applicator.service";

/* ------------------------------------------------------------------ */
/*  Validity gate (pure)                                               */
/* ------------------------------------------------------------------ */

describe("PolicyApplicatorService.policyAppliesTo — validity gate", () => {
  const validFrom = new Date("2026-05-01T00:00:00.000Z");
  const validUntil = new Date("2026-08-01T00:00:00.000Z");

  it("returns true when active and deadline is inside [validFrom, validUntil]", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: true, validFrom, validUntil },
      { deadline: new Date("2026-06-15T18:00:00.000Z") },
    );
    expect(result).toBe(true);
  });

  it("returns false when policy.active is false", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: false, validFrom, validUntil },
      { deadline: new Date("2026-06-15T18:00:00.000Z") },
    );
    expect(result).toBe(false);
  });

  it("returns false when deadline is before validFrom", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: true, validFrom, validUntil },
      { deadline: new Date("2026-04-15T18:00:00.000Z") },
    );
    expect(result).toBe(false);
  });

  it("returns false when deadline is after validUntil", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: true, validFrom, validUntil },
      { deadline: new Date("2026-09-15T18:00:00.000Z") },
    );
    expect(result).toBe(false);
  });

  it("returns true when validUntil is null (forever-policy)", () => {
    const result = PolicyApplicatorService.policyAppliesTo(
      { active: true, validFrom, validUntil: null },
      { deadline: new Date("2030-01-01T00:00:00.000Z") },
    );
    expect(result).toBe(true);
  });

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
});
