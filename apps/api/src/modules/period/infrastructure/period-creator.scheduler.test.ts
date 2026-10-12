import type { AppSettings } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import type { AutoCarryOverOutcome } from "../../carry-over/index.js";
import { readMostRecentLivePeriod } from "../application/period-factory-lookup.js";
import {
  flipDueScheduledToOpen,
  PeriodCreatorScheduler,
} from "./period-creator.scheduler.js";

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: true,
    defaultDeadlineDays: 4,
    periodLengthDays: 7,
    workingDays: "mon-fri",
    gracePeriodHours: 24,
    allowLateSubmissions: true,
    autoPublishAfterDeadline: false,
    autoArchiveWeeksAfterPublish: 0,
    defaultTimezone: "Europe/Moscow",
    defaultReminderAudience: "lead-with-draft",
    notificationFromEmail: null,
    // period-cycle knobs at SQL defaults. The creator reads
    // `periodLengthDays` / `defaultDeadlineDays` / `workingDays`.
    deadlineTime: "18:00",
    allowReopenAfterPublish: true,
    reopenWindowHours: 72,
    unifiedActivityView: false,
    ...overrides,
  };
}

interface ReportCreateData {
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  periodState: "scheduled" | "open";
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

interface StubPrisma {
  $transaction: ReturnType<typeof vi.fn>;
  report: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
}

function makePrismaStub(opts: {
  mostRecent: { id: string; periodEnd: Date } | null;
  createdId?: string;
  // mostRecent (orderBy) and find-by-bounds share findFirst; stub branches on orderBy.
  existingInWindow?: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    periodState: "scheduled" | "open";
  } | null;
}): StubPrisma {
  const report = {
    findFirst: vi
      .fn()
      .mockImplementation((args?: { orderBy?: unknown }) =>
        args?.orderBy ? opts.mostRecent : (opts.existingInWindow ?? null),
      ),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: ReportCreateData }) => ({
        id: opts.createdId ?? "period-new",
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        deadline: data.deadline,
        periodState: data.periodState,
      })),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const transactionClient = {
    $queryRaw: vi.fn((query: unknown) =>
      sqlText(query).includes('FROM "ReminderPolicy"')
        ? []
        : [
            {
              id: "period-due",
              deadline: new Date("2026-05-16T18:00:00.000Z"),
              periodState: "open",
              archived: false,
            },
          ],
    ),
    report,
    reminderRule: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    $transaction: vi.fn(
      (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    ),
    report,
  };
}

// Partial DI stubs supply only the methods exercised by these tests.
const asStub = <T>(value: unknown, _target?: T): T => value as T;

function createScheduler(
  prisma: StubPrisma,
  admin: unknown,
  audit: unknown,
  policyApplicator: unknown = {
    applyToPeriod: vi.fn(),
    repairToPeriod: vi.fn(),
  },
  autoCarryOver: unknown = vi.fn().mockResolvedValue({ status: "no-source" }),
): PeriodCreatorScheduler {
  return new PeriodCreatorScheduler(
    asStub(prisma),
    asStub(admin),
    asStub(audit),
    asStub(policyApplicator),
    asStub(autoCarryOver),
  );
}

describe("PeriodCreatorScheduler", () => {
  it("uses the canonical live lifecycle predicate for the future horizon", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      readMostRecentLivePeriod(asStub({ findFirst })),
    ).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        status: "draft",
        periodStatus: "open",
        periodState: { in: ["scheduled", "open"] },
        archived: false,
      },
      orderBy: { periodStart: "desc" },
      select: { id: true, periodEnd: true },
    });
  });

  it("skip-when-disabled: autoCreatePeriods=false → no create, no audit", async () => {
    const prisma = makePrismaStub({ mostRecent: null });
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoCreatePeriods: false })),
    };
    const audit = createNullAuditLogger();
    const scheduler = createScheduler(prisma, admin, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({ created: false, reason: "disabled" });
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("opens a due scheduled period when auto-create is disabled without creating a period", async () => {
    const prisma = makePrismaStub({ mostRecent: null });
    const due = {
      id: "period-due",
      periodStart: new Date("2026-05-12T00:00:00.000Z"),
      periodEnd: new Date("2026-05-18T23:59:59.999Z"),
      status: "draft",
      periodStatus: "open",
      archived: false,
      autoPublished: false,
      autoArchived: false,
      publishedAt: null,
      publishedById: null,
      reopenedAt: null,
    };
    prisma.report.findMany.mockResolvedValue([due]);
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoCreatePeriods: false })),
    };
    const scheduler = createScheduler(prisma, admin, createNullAuditLogger());

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({ created: false, reason: "disabled" });
    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: {
        id: due.id,
        periodState: "scheduled",
        periodStart: {
          equals: due.periodStart,
          lte: new Date("2026-05-12T00:05:00Z"),
        },
        periodEnd: due.periodEnd,
        status: "draft",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
      data: {
        periodState: "open",
        status: "draft",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    });
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("reconciles carry-over for open periods when auto-create is disabled", async () => {
    const prisma = makePrismaStub({ mostRecent: null });
    // The flip pass queries periodState:"scheduled" (no due rows); the
    // reconcile pass queries periodState:"open".
    prisma.report.findMany.mockImplementation(
      (args: { where?: { periodState?: unknown } }) =>
        args.where?.periodState === "open" ? [{ id: "open-1" }] : [],
    );
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoCreatePeriods: false })),
    };
    const autoCarryOver = vi
      .fn<(targetReportId: string) => Promise<AutoCarryOverOutcome>>()
      .mockResolvedValue({
        status: "completed",
        sourceReportId: "source-1",
        targetReportId: "target-1",
        authorCount: 1,
      });
    const scheduler = createScheduler(
      prisma,
      admin,
      createNullAuditLogger(),
      undefined,
      autoCarryOver,
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({ created: false, reason: "disabled" });
    expect(autoCarryOver.mock.calls.map((call) => call[0])).toEqual(["open-1"]);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("fire-when-eligible: prev period ended in the past → creates new Period + emits audit", async () => {
    // Previous period ended last Sunday; today is Monday → create next period.
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      },
      createdId: "period-new-1",
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = createScheduler(prisma, admin, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-new-1" });
    expect(prisma.report.create).toHaveBeenCalledTimes(1);
    // The state column is written on create; here periodStart is "this
    // week's Monday" which is <= now, so the period lands as 'open'.
    expect(prisma.report.create.mock.calls).toMatchObject([
      [{ data: { periodState: "open" } }],
    ]);
    expect(audit.periodAutoCreate).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        periodId: "period-new-1",
        from: null,
        to: "open",
      }),
    );
  });

  it("runs the SCHEDULED→OPEN flip (reads due scheduled rows) at the top of the tick", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-future",
        // The most-recent period ends in the future, so no create happens.
        // The flip still runs first.
        periodEnd: new Date("2026-05-30T23:59:59.999Z"),
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = createScheduler(prisma, admin, audit);

    await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    // The flip queries the due scheduled rows in a deterministic order; the
    // per-row update behaviour is covered by the focused tests below.
    expect(prisma.report.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        periodState: "scheduled",
        periodStart: { lte: new Date("2026-05-12T00:05:00Z") },
      },
      orderBy: [{ periodStart: "asc" }, { id: "asc" }],
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        periodStatus: true,
        archived: true,
        autoPublished: true,
        autoArchived: true,
        publishedAt: true,
        publishedById: true,
        reopenedAt: true,
      },
    });
  });

  it("reconciles carry-over for every fresh-open period, then the just-created one", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      },
      createdId: "period-new-1",
    });
    // flipDueScheduledToOpen queries periodState:"scheduled" (no due rows);
    // the reconcile pass queries periodState:"open" — TWO open periods, the
    // multi-flip case a latest-only implementation would miss.
    prisma.report.findMany.mockImplementation(
      (args: { where?: { periodState?: unknown } }) =>
        args.where?.periodState === "open"
          ? [{ id: "open-1" }, { id: "open-2" }]
          : [],
    );
    const admin = { getSettings: vi.fn().mockResolvedValue(makeSettings()) };
    const autoCarryOver = vi
      .fn<(targetReportId: string) => Promise<AutoCarryOverOutcome>>()
      .mockResolvedValue({
        status: "completed",
        sourceReportId: "source-1",
        targetReportId: "target-1",
        authorCount: 1,
      });
    const scheduler = createScheduler(
      prisma,
      admin,
      createNullAuditLogger(),
      undefined,
      autoCarryOver,
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-new-1" });
    // Every open period reconciled, and the same-tick open-born creation too.
    expect(autoCarryOver.mock.calls.map((call) => call[0])).toEqual([
      "open-1",
      "open-2",
      "period-new-1",
    ]);
    // The reconcile query excludes reopened (periodStatus) and archived rows.
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: { periodState: "open", periodStatus: "open", archived: false },
      select: { id: true },
    });
  });

  it("a scheduled-born creation does not fire carry-over at mint time", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        // Ends exactly now (Sunday 23:59:59.999): the create proceeds, but
        // the Monday-anchored next periodStart is still in the future →
        // minted 'scheduled'.
        periodEnd: new Date("2026-05-17T23:59:59.999Z"),
      },
      createdId: "period-new-1",
    });
    const admin = { getSettings: vi.fn().mockResolvedValue(makeSettings()) };
    const autoCarryOver = vi.fn().mockResolvedValue({
      status: "completed",
      sourceReportId: "source-1",
      targetReportId: "target-1",
      authorCount: 1,
    });
    const scheduler = createScheduler(
      prisma,
      admin,
      createNullAuditLogger(),
      undefined,
      autoCarryOver,
    );

    const result = await scheduler.runOnce(
      new Date("2026-05-17T23:59:59.999Z"),
    );

    expect(result).toMatchObject({
      created: true,
      periodState: "scheduled",
    });
    // No open periods in the stub and the creation is scheduled-born: the
    // carry for it happens later, at its scheduled→open flip.
    expect(autoCarryOver).not.toHaveBeenCalled();
  });

  it("policyApplicator.applyToPeriod called once when period is created", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      },
      createdId: "period-td06",
    });
    const admin = { getSettings: vi.fn().mockResolvedValue(makeSettings()) };
    const policyApplicator = {
      applyToPeriod: vi.fn().mockResolvedValue(undefined),
    };
    const scheduler = createScheduler(
      prisma,
      admin,
      createNullAuditLogger(),
      policyApplicator,
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-td06" });
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledTimes(1);
    // The factory delegates with `now` so the applicator can drop elapsed
    // instants; the scheduler creates future periods, so nothing is dropped.
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledWith(
      "period-td06",
      expect.any(Date),
    );
  });

  it("idempotent: future period already exists → skip, no create, no audit", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-current",
        periodEnd: new Date("2026-05-17T23:59:59.999Z"), // ends in the future
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = createScheduler(prisma, admin, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({
      created: false,
      reason: "future-period-exists",
    });
    expect(prisma.report.create).not.toHaveBeenCalled();
    expect(audit.periodAutoCreate).not.toHaveBeenCalled();
  });

  it("treats a distinct range-overlap conflict as a safe create skip", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      },
    });
    prisma.report.create.mockRejectedValue({
      code: "P2039",
      message:
        'Database error. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "Report_no_live_period_overlap"`',
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
    });
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = createScheduler(
      prisma,
      { getSettings: vi.fn().mockResolvedValue(makeSettings()) },
      audit,
    );

    await expect(
      scheduler.runOnce(new Date("2026-05-12T00:05:00Z")),
    ).resolves.toEqual({
      created: false,
      reason: "future-period-exists",
    });
    expect(audit.periodAutoCreate).not.toHaveBeenCalled();
  });
});

const W = new Date("2026-05-11T00:00:00.000Z");
const W_END = new Date("2026-05-17T23:59:59.999Z");

interface FlipReportStub {
  findMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
}

function makeFlipPrisma(
  report: FlipReportStub,
  policies: readonly object[] = [],
) {
  const $queryRaw = vi.fn((query: unknown) =>
    sqlText(query).includes('FROM "ReminderPolicy"')
      ? policies
      : [
          {
            id: "s1",
            deadline: new Date("2026-05-16T18:00:00.000Z"),
            periodState: "open",
            status: "draft",
            periodStatus: "open",
            archived: false,
          },
        ],
  );
  const reminderRule = {
    findFirst: vi.fn().mockResolvedValue(null),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "rule-v1" }),
  };
  const tx = {
    $queryRaw,
    report,
    reminderRule,
  };
  return {
    report,
    $queryRaw,
    reminderRule,
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
}

describe("flipDueScheduledToOpen", () => {
  const now = new Date("2026-05-12T00:05:00.000Z");

  it("opens a row that is still scheduled via the governed transition", async () => {
    const report: FlipReportStub = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          periodStart: W,
          periodEnd: W_END,
          status: "draft",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const logger = { log: vi.fn(), warn: vi.fn() };
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
    const prisma = makeFlipPrisma(report, [policy]);

    await flipDueScheduledToOpen(asStub(prisma), now, logger);

    expect(report.updateMany).toHaveBeenCalledWith({
      where: {
        id: "s1",
        periodState: "scheduled",
        periodStart: { equals: W, lte: now },
        periodEnd: W_END,
        status: "draft",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
      data: {
        periodState: "open",
        status: "draft",
        periodStatus: "open",
        archived: false,
        autoPublished: false,
        autoArchived: false,
        publishedAt: null,
        publishedById: null,
        reopenedAt: null,
      },
    });
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    const createArgs = prisma.reminderRule.create.mock
      .calls[0]?.[0] as unknown as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      reportId: "s1",
      policyId: policy.id,
      status: "active",
    });
  });

  it("logs and skips a row concurrently transitioned away from scheduled", async () => {
    const report: FlipReportStub = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          periodStart: W,
          periodEnd: W_END,
          status: "draft",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    const logger = { log: vi.fn(), warn: vi.fn() };
    const prisma = makeFlipPrisma(report);

    await flipDueScheduledToOpen(asStub(prisma), now, logger);

    const updateArgs = report.updateMany.mock.calls[0]?.[0] as unknown as {
      where: Record<string, unknown>;
    };
    expect(updateArgs.where).toMatchObject({
      id: "s1",
      periodState: "scheduled",
      periodStart: { equals: W, lte: now },
      periodEnd: W_END,
      status: "draft",
      periodStatus: "open",
      archived: false,
      autoPublished: false,
      autoArchived: false,
      publishedAt: null,
      publishedById: null,
      reopenedAt: null,
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("transitioned away from scheduled"),
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it("does not open a row moved into the future after the due scan", async () => {
    const updateMany = vi.fn().mockImplementation(() => {
      // Deterministic interleaving: the admin edit commits between findMany
      // and the scheduler CAS, moving the same scheduled row to the future.
      return { count: 0 };
    });
    const report: FlipReportStub = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          periodStart: W,
          periodEnd: W_END,
          status: "draft",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
      updateMany,
    };

    await flipDueScheduledToOpen(asStub(makeFlipPrisma(report)), now, {
      log: vi.fn(),
      warn: vi.fn(),
    });

    const updateArgs = updateMany.mock.calls[0]?.[0] as unknown as {
      where: Record<string, unknown>;
    };
    expect(updateArgs.where).toMatchObject({
      periodStart: { equals: W, lte: now },
      periodEnd: W_END,
    });
  });

  it("re-throws an unrelated error and aborts the tick", async () => {
    const report: FlipReportStub = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          periodStart: W,
          periodEnd: W_END,
          status: "draft",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
      updateMany: vi.fn().mockRejectedValue(new Error("db down")),
    };

    await expect(
      flipDueScheduledToOpen(asStub(makeFlipPrisma(report)), now, {
        log: vi.fn(),
        warn: vi.fn(),
      }),
    ).rejects.toThrow("db down");
  });
});
