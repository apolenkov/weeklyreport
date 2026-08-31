import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { PolicyApplicatorService } from "./policy-applicator.service.js";

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
  const $queryRaw = vi
    .fn()
    .mockResolvedValueOnce(policies)
    .mockResolvedValueOnce([
      {
        ...PERIOD,
        periodState: "open",
        archived: false,
      },
    ]);
  const reminderRule = {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  const tx = { $queryRaw, reminderRule };
  return {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    $queryRaw,
    reminderRule: {
      ...reminderRule,
    },
  };
}

async function exerciseExcludedPolicies(policyCount: number) {
  const prisma = makePrismaStub(policyCount);
  const service = new PolicyApplicatorService(
    prisma as unknown as PrismaService,
  );
  const excludedPolicyIds = new Set(
    Array.from({ length: policyCount }, (_, index) => makePolicy(index).id),
  );
  const result = await service.applyToPeriod(
    PERIOD.id,
    undefined,
    excludedPolicyIds,
  );
  return { prisma, result };
}

describe("PolicyApplicatorService fan-out performance", () => {
  it("keeps excluded fan-out to one transaction and two lock reads", async () => {
    const policyCount = 256;
    const { prisma, result } = await exerciseExcludedPolicies(policyCount);

    expect(result).toEqual({ created: 0, updated: 0, skipped: policyCount });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.reminderRule.findFirst).not.toHaveBeenCalled();
  });
});
