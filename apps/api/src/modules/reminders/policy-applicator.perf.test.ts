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

  return {
    reminderPolicy: {
      findMany: vi.fn().mockResolvedValue(policies),
    },
    reminderRule: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "new-rule" }),
    },
  };
}

async function countArrayIterationSteps(policyCount: number): Promise<number> {
  const service = new PolicyApplicatorService(
    makePrismaStub(policyCount) as unknown as PrismaService,
  );
  const excludedPolicyIds = new Set(
    Array.from({ length: policyCount }, (_, index) => makePolicy(index).id),
  );
  const originalIterator = Array.prototype[Symbol.iterator];
  const iterationSteps = new Int32Array(new SharedArrayBuffer(4));

  Object.defineProperty(Array.prototype, Symbol.iterator, {
    configurable: true,
    value: function () {
      const iterator = originalIterator.call(this);

      return {
        next: () => {
          Atomics.add(iterationSteps, 0, 1);
          return iterator.next();
        },
        [Symbol.iterator]() {
          return this;
        },
      };
    },
    writable: true,
  });

  try {
    await service.applyToPeriod(PERIOD, undefined, excludedPolicyIds);
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      value: originalIterator,
      writable: true,
    });
  }

  return Atomics.load(iterationSteps, 0);
}

describe("PolicyApplicatorService fan-out performance", () => {
  it("does not copy a growing outcome array while accumulating", async () => {
    const policyCount = 256;
    const arrayIterationSteps = await countArrayIterationSteps(policyCount);

    expect(arrayIterationSteps).toBeLessThan(policyCount);
  });
});
