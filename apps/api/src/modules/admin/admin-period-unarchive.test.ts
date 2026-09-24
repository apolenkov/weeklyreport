import { isDeepStrictEqual } from "node:util";

import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { archivePeriod, unarchivePeriod } from "./admin-period-lifecycle";
import {
  AdminPeriodOverlapError,
  AdminPeriodStaleStateError,
} from "./admin-shared";

const ARCHIVED_ROW = {
  periodStart: new Date("2026-08-31T00:00:00.000Z"),
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
  expected: Record<string, unknown> = ARCHIVED_ROW,
): boolean {
  if (current === null) return false;
  return Object.entries(expected).every(([field]) =>
    isDeepStrictEqual(where[field], current[field]),
  );
}

function fakePrisma(
  currentAfterRead: LifecycleRow,
  updateError?: unknown,
  readRow: Record<string, unknown> = ARCHIVED_ROW,
) {
  const findUnique = vi.fn(() => Promise.resolve(readRow));
  const updateMany = vi.fn((args: { where: Record<string, unknown> }) => {
    if (updateError) return Promise.reject(updateError);
    return Promise.resolve({
      count: matchesExpected(args.where, currentAfterRead, readRow) ? 1 : 0,
    });
  });
  const transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) =>
    run({
      $queryRaw: vi.fn().mockResolvedValue([]),
      report: { findUnique, updateMany },
      reminderRule: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    }),
  );
  return {
    findUnique,
    updateMany,
    prisma: { $transaction: transaction } as unknown as PrismaService,
  };
}

describe("archivePeriod reminder lifecycle", () => {
  it("pauses active rules in the same policy-first transaction", async () => {
    const events: string[] = [];
    const tx = {
      $queryRaw: vi.fn().mockImplementation(() => {
        events.push("policies-locked");
        return [];
      }),
      report: {
        updateMany: vi.fn().mockImplementation(() => {
          events.push("report-archived");
          return { count: 1 };
        }),
      },
      reminderRule: {
        updateMany: vi.fn().mockImplementation(() => {
          events.push("rules-paused");
          return { count: 1 };
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(archivePeriod(prisma, "report-1")).resolves.toBeUndefined();

    expect(events).toEqual([
      "policies-locked",
      "report-archived",
      "rules-paused",
    ]);
    expect(tx.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { reportId: "report-1", status: "active" },
      data: { status: "paused" },
    });
  });
});

describe("unarchivePeriod lifecycle compare-and-set", () => {
  const NOW = new Date("2026-08-30T12:00:00.000Z");

  it("restores a future scheduled draft", async () => {
    const { prisma, updateMany } = fakePrisma(ARCHIVED_ROW);

    await expect(unarchivePeriod(prisma, "report-1", NOW)).resolves.toEqual({
      nextPeriodState: "scheduled",
    });
    expect(updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: "report-1", ...ARCHIVED_ROW },
      data: { archived: false, periodState: "scheduled", autoArchived: false },
    });
  });

  it("reconciles reminder rules before an archived draft becomes editable", async () => {
    const deadline = new Date("2026-09-02T18:00:00.000Z");
    const policy = {
      id: "policy-1",
      kind: "deadline",
      offsetMinutes: -180,
      timezone: "Europe/Moscow",
      audience: "LEAD_WITH_DRAFT",
      active: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const readRow = { ...ARCHIVED_ROW, deadline };
    const report = {
      findUnique: vi.fn().mockResolvedValue(readRow),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const reminderRule = {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "rule-v1" }),
    };
    const $queryRaw = vi
      .fn()
      .mockResolvedValueOnce([policy])
      .mockResolvedValueOnce([
        {
          id: "report-1",
          deadline,
          periodState: "open",
          status: "draft",
          periodStatus: "open",
          archived: false,
        },
      ]);
    const tx = { $queryRaw, report, reminderRule };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      unarchivePeriod(prisma, "report-1", new Date("2026-09-01T00:00:00.000Z")),
    ).resolves.toMatchObject({ nextPeriodState: "open" });
    const createArgs = reminderRule.create.mock.calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId: "report-1",
      policyId: policy.id,
      deadline,
      status: "active",
    });
  });

  it.each([
    ["at the period boundary", ARCHIVED_ROW.periodStart],
    ["after the period started", new Date("2026-09-01T00:00:00.000Z")],
  ])("restores an elapsed draft as open %s", async (_label, now) => {
    const { prisma, updateMany } = fakePrisma(ARCHIVED_ROW);

    await expect(unarchivePeriod(prisma, "report-1", now)).resolves.toEqual({
      nextPeriodState: "open",
    });
    expect(updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: "report-1", ...ARCHIVED_ROW },
      data: { archived: false, periodState: "open", autoArchived: false },
    });
  });

  it("restores a published period as published regardless of its start", async () => {
    const published = {
      ...ARCHIVED_ROW,
      status: "published" as const,
      periodStatus: "published" as const,
      publishedAt: new Date("2026-08-01T12:00:00.000Z"),
      publishedById: "00000000-0000-4000-8000-000000000001",
    };
    const { prisma, updateMany } = fakePrisma(published, undefined, published);

    await expect(unarchivePeriod(prisma, "report-1", NOW)).resolves.toEqual({
      nextPeriodState: "published",
    });
    expect(updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: "report-1", ...published },
      data: { archived: false, periodState: "published", autoArchived: false },
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

    await expect(
      unarchivePeriod(prisma, "report-1", NOW),
    ).rejects.toBeInstanceOf(AdminPeriodStaleStateError);
  });

  it("maps a range exclusion collision after a matching read", async () => {
    const collision = new Prisma.PrismaClientKnownRequestError(
      'Database error. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "Report_no_live_period_overlap"`',
      {
        code: "P2039",
        clientVersion: "test",
        meta: {
          driverAdapterError: {
            cause: {
              kind: "postgres",
              originalCode: "23P01",
              originalMessage:
                'conflicting key value violates exclusion constraint "Report_no_live_period_overlap"',
            },
          },
        },
      },
    );
    const { prisma } = fakePrisma(ARCHIVED_ROW, collision);

    await expect(
      unarchivePeriod(prisma, "report-1", NOW),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });
});
