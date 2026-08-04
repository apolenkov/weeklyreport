import { isDeepStrictEqual } from "node:util";

import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { unarchivePeriod } from "./admin-period-lifecycle";
import {
  AdminPeriodOverlapError,
  AdminPeriodStaleStateError,
} from "./admin-shared";

const ARCHIVED_ROW = {
  status: "draft" as const,
  periodState: "archived" as const,
  periodStatus: "open" as const,
  archived: true,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

type LifecycleRow = Record<string, unknown> | null;

function matchesExpected(
  where: Record<string, unknown>,
  current: LifecycleRow,
): boolean {
  if (current === null) return false;
  return Object.entries(ARCHIVED_ROW).every(([field]) =>
    isDeepStrictEqual(where[field], current[field]),
  );
}

function fakePrisma(currentAfterRead: LifecycleRow, updateError?: unknown) {
  const findUnique = vi.fn(() => Promise.resolve(ARCHIVED_ROW));
  const updateMany = vi.fn((args: { where: Record<string, unknown> }) => {
    if (updateError) return Promise.reject(updateError);
    return Promise.resolve({
      count: matchesExpected(args.where, currentAfterRead) ? 1 : 0,
    });
  });
  const transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) =>
    run({ report: { findUnique, updateMany } }),
  );
  return {
    findUnique,
    updateMany,
    prisma: { $transaction: transaction } as unknown as PrismaService,
  };
}

describe("unarchivePeriod tuple compare-and-set", () => {
  it("writes only when the complete lifecycle tuple still matches", async () => {
    const { prisma, updateMany } = fakePrisma(ARCHIVED_ROW);

    await expect(unarchivePeriod(prisma, "report-1")).resolves.toEqual({
      nextPeriodState: "open",
      nextPeriodStatus: "open",
    });
    expect(updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: "report-1", ...ARCHIVED_ROW },
      data: { archived: false, periodState: "open" },
    });
  });

  it.each([
    {
      label: "publish",
      current: {
        ...ARCHIVED_ROW,
        status: "published",
        periodState: "published",
        periodStatus: "published",
        archived: false,
      },
    },
    {
      label: "reopen",
      current: {
        ...ARCHIVED_ROW,
        status: "published",
        periodState: "open",
        periodStatus: "reopened",
        archived: false,
        reopenedAt: new Date("2026-08-01T12:00:00.000Z"),
      },
    },
    {
      label: "archive audit update",
      current: { ...ARCHIVED_ROW, autoArchived: true },
    },
    {
      label: "second unarchive",
      current: { ...ARCHIVED_ROW, periodState: "open", archived: false },
    },
    { label: "deletion", current: null },
  ])("fails closed after concurrent $label", async ({ current }) => {
    const { prisma } = fakePrisma(current);

    await expect(unarchivePeriod(prisma, "report-1")).rejects.toBeInstanceOf(
      AdminPeriodStaleStateError,
    );
  });

  it("maps an open-boundary collision after a matching read", async () => {
    const collision = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: "Report_one_open_per_boundary" },
      },
    );
    const { prisma } = fakePrisma(ARCHIVED_ROW, collision);

    await expect(unarchivePeriod(prisma, "report-1")).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });
});
