/**
 * TD-05 / Phase 47 — PolicyApplicatorService fan-out performance test.
 *
 * Verifies that applyToPeriod completes within an acceptable wall-clock
 * budget when a large number of active policies are in scope. Uses a
 * minimal Prisma stub (no real DB) so the measured time reflects service
 * logic overhead, not I/O latency.
 *
 * Threshold: 50 active policies must complete in < 200 ms. This is
 * intentionally loose (the real service adds DB latency per policy via
 * findUnique + upsert) — the unit threshold catches accidental O(N²)
 * regressions while remaining stable on CI.
 */

import { describe, expect, it, vi } from "vitest";

import { PolicyApplicatorService } from "./policy-applicator.service.js";

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

const PERIOD = {
  id: "d0000000-0000-4000-8000-000000000001",
  deadline: new Date("2026-06-20T18:00:00.000Z"),
};

const VALID_FROM = new Date("2026-05-01T00:00:00.000Z");

function makePolicy(index: number) {
  return {
    id: `p${String(index).padStart(4, "0")}-0000-4000-8000-000000000000`,
    kind: "deadline" as const,
    offsetMinutes: -(1440 + index),
    timezone: "Europe/Moscow",
    audience: "lead-with-draft",
    active: true,
    validFrom: VALID_FROM,
    validUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePrismaStub(policyCount: number) {
  const policies = Array.from({ length: policyCount }, (_, i) => makePolicy(i));

  return {
    reminderPolicy: {
      findMany: vi.fn().mockResolvedValue(policies),
    },
    reminderRule: {
      // Simulate "no existing rule" → create path on every upsert
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "new-rule" }),
    },
  };
}

// ---------------------------------------------------------------------------
// Performance tests
// ---------------------------------------------------------------------------

describe("TD-05: PolicyApplicatorService fan-out performance", () => {
  it("completes 10 active policies within 50 ms", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    const service = new PolicyApplicatorService(makePrismaStub(10) as any);

    const start = performance.now();
    const result = await service.applyToPeriod(PERIOD);
    const elapsed = performance.now() - start;

    expect(result.created).toBe(10);
    expect(result.skipped).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });

  it("completes 50 active policies within 200 ms", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    const service = new PolicyApplicatorService(makePrismaStub(50) as any);

    const start = performance.now();
    const result = await service.applyToPeriod(PERIOD);
    const elapsed = performance.now() - start;

    expect(result.created).toBe(50);
    expect(result.skipped).toBe(0);
    expect(elapsed).toBeLessThan(200);
  });

  it("each policy triggers exactly one findUnique + one upsert call", async () => {
    const prismaStub = makePrismaStub(5);
    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    const service = new PolicyApplicatorService(prismaStub as any);

    await service.applyToPeriod(PERIOD);

    expect(prismaStub.reminderRule.findUnique).toHaveBeenCalledTimes(5);
    expect(prismaStub.reminderRule.upsert).toHaveBeenCalledTimes(5);
  });

  it("policies outside the validity window are skipped without a DB write", async () => {
    const prismaStub = makePrismaStub(0);
    // Add 3 expired policies (validUntil in the past)
    const expiredPolicies = [1, 2, 3].map((i) => ({
      ...makePolicy(i),
      validUntil: new Date("2026-01-01T00:00:00.000Z"), // deadline 2026-06-20 > validUntil
    }));
    prismaStub.reminderPolicy.findMany.mockResolvedValue(expiredPolicies);

    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    const service = new PolicyApplicatorService(prismaStub as any);
    const result = await service.applyToPeriod(PERIOD);

    expect(result.skipped).toBe(3);
    expect(result.created).toBe(0);
    expect(prismaStub.reminderRule.findUnique).not.toHaveBeenCalled();
    expect(prismaStub.reminderRule.upsert).not.toHaveBeenCalled();
  });

  it("upsert on an already-existing rule increments updated, not created", async () => {
    const prismaStub = makePrismaStub(2);
    // First policy has an existing rule; second does not.
    prismaStub.reminderRule.findUnique
      .mockResolvedValueOnce({ id: "existing-rule" }) // first policy → updated
      .mockResolvedValueOnce(null); // second policy → created

    // biome-ignore lint/suspicious/noExplicitAny: intentional any for test/runtime escape hatch (migrated from eslint-disable)
    const service = new PolicyApplicatorService(prismaStub as any);
    const result = await service.applyToPeriod(PERIOD);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
