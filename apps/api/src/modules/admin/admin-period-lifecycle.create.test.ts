import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createPeriodManual } from "./admin-period-lifecycle";

const INPUT = {
  periodStart: new Date("2026-08-03T00:00:00.000Z"),
  periodEnd: new Date("2026-08-09T23:59:59.999Z"),
  deadline: new Date("2026-08-07T15:00:00.000Z"),
  weekLabel: null,
};

function fakePrisma() {
  const create = vi.fn(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: "report-created",
      periodStart: INPUT.periodStart,
      periodEnd: INPUT.periodEnd,
      deadline: INPUT.deadline,
      periodState: data.periodState,
    }),
  );
  return {
    create,
    prisma: { report: { create } } as unknown as PrismaService,
  };
}

describe("createPeriodManual lifecycle input", () => {
  it.each(["scheduled", "open"] as const)(
    "persists the legal %s state without coercion",
    async (periodState) => {
      const { create, prisma } = fakePrisma();

      await expect(
        createPeriodManual(prisma, { ...INPUT, periodState }),
      ).resolves.toMatchObject({ periodState });
      expect(create.mock.calls[0]?.[0]).toMatchObject({
        data: {
          periodState,
          status: "draft",
          archived: false,
        },
      });
    },
  );

  it.each(["published", "archived", "widened-state"])(
    "rejects %s before calling Prisma",
    async (periodState) => {
      const { create, prisma } = fakePrisma();
      const widenedInput = { ...INPUT, periodState };

      await expect(
        // @ts-expect-error Runtime guard is planted against widened callers.
        createPeriodManual(prisma, widenedInput),
      ).rejects.toMatchObject({ name: "ZodError" });
      expect(create).not.toHaveBeenCalled();
    },
  );
});
