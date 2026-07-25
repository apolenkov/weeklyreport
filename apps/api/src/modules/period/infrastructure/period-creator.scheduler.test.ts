import type { AppSettings } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../lib/audit-logger.js";
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

interface StubPrisma {
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
  return {
    report: {
      findFirst: vi
        .fn()
        .mockImplementation((args?: { orderBy?: unknown }) =>
          args?.orderBy ? opts.mostRecent : (opts.existingInWindow ?? null),
        ),
      // The scheduler `await`s create(); a plain object resolves the same, so the
      // stub stays sync (no `async` → no require-await disable to keep in place).
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: ReportCreateData }) => ({
          id: opts.createdId ?? "period-new",
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          deadline: data.deadline,
          // Echo the periodState the scheduler wrote so the returned shape
          // matches the real prisma client surface.
          periodState: data.periodState,
        })),
      // The flip reads due scheduled rows then updates each.
      // The runOnce-level tests exercise the create/skip paths, so the default
      // is "no due scheduled rows" — the flip is a no-op. The flip's own
      // recovery is covered by the focused flipDueScheduledToOpen tests below.
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

// Cast to never via Nest DI seam — the scheduler types its constructor on
// PrismaService + settings service; tests pass a minimal shape with only the
// methods exercised.
const asAny = <T>(x: unknown): T => x as T;

describe("PeriodCreatorScheduler", () => {
  it("skip-when-disabled: autoCreatePeriods=false → no create, no audit", async () => {
    const prisma = makePrismaStub({ mostRecent: null });
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoCreatePeriods: false })),
    };
    const audit = createNullAuditLogger();
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      audit,
    );

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
    };
    prisma.report.findMany.mockResolvedValue([due]);
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoCreatePeriods: false })),
    };
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      createNullAuditLogger(),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({ created: false, reason: "disabled" });
    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: { id: due.id, periodState: "scheduled" },
      data: { periodState: "open", status: "draft", archived: false },
    });
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
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
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-new-1" });
    expect(prisma.report.create).toHaveBeenCalledTimes(1);
    // The state column is written on create; here periodStart is "this
    // week's Monday" which is <= now, so the period lands as 'open'.
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() returns any; vitest asymmetric matcher has no precise type
        data: expect.objectContaining({ periodState: "open" }),
      }),
    );
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
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    // The flip queries the due scheduled rows in a deterministic order; the
    // per-row update behaviour is covered by the focused tests below.
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: {
        periodState: "scheduled",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() returns any; vitest asymmetric matcher has no precise type
        periodStart: { lte: expect.any(Date) },
      },
      orderBy: [{ periodStart: "asc" }, { id: "asc" }],
      select: { id: true, periodStart: true, periodEnd: true },
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
      .fn<(targetReportId: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
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
    const autoCarryOver = vi.fn().mockResolvedValue(undefined);
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
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
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      createNullAuditLogger(),
      asAny(policyApplicator),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-td06" });
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledTimes(1);
    // The factory delegates with `now` so the applicator can drop elapsed
    // instants; the scheduler creates future periods, so nothing is dropped.
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ id: "period-td06" }),
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
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({
      created: false,
      reason: "future-period-exists",
    });
    expect(prisma.report.create).not.toHaveBeenCalled();
    expect(audit.periodAutoCreate).not.toHaveBeenCalled();
  });
});

const W = new Date("2026-05-11T00:00:00.000Z");
const W_END = new Date("2026-05-17T23:59:59.999Z");

// Prisma P2002 whose meta.target is the open-boundary index name.
function openBoundaryP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: "Report_one_open_per_boundary" },
  });
}

interface FlipReportStub {
  findMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
}

describe("flipDueScheduledToOpen", () => {
  const now = new Date("2026-05-12T00:05:00.000Z");

  it("opens a row that is still scheduled via the governed transition", async () => {
    const report: FlipReportStub = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "s1", periodStart: W, periodEnd: W_END }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn(),
    };
    const logger = { log: vi.fn(), warn: vi.fn() };

    await flipDueScheduledToOpen(asAny(report), now, logger);

    expect(report.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", periodState: "scheduled" },
      data: { periodState: "open", status: "draft", archived: false },
    });
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs and skips a row concurrently transitioned away from scheduled", async () => {
    const report: FlipReportStub = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "s1", periodStart: W, periodEnd: W_END }]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn(),
    };
    const logger = { log: vi.fn(), warn: vi.fn() };

    await flipDueScheduledToOpen(asAny(report), now, logger);

    expect(report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1", periodState: "scheduled" },
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("transitioned away from scheduled"),
    );
    expect(report.findFirst).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("(a) a boundary another writer already opened is skipped, the duplicate scheduled row is left + logged", async () => {
    const report: FlipReportStub = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "s1", periodStart: W, periodEnd: W_END }]),
      updateMany: vi.fn().mockRejectedValue(openBoundaryP2002()),
      findFirst: vi.fn().mockResolvedValue({ id: "open-existing" }),
    };
    const logger = { log: vi.fn(), warn: vi.fn() };

    await flipDueScheduledToOpen(asAny(report), now, logger);

    expect(report.updateMany).toHaveBeenCalledTimes(1);
    // recovery re-read keys on the boundary + periodState='open'
    expect(report.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodStart: W, periodEnd: W_END, periodState: "open" },
        select: { id: true },
      }),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("already open"),
    );
  });

  it("(b) two scheduled rows on one boundary → exactly one opens, the other is left scheduled + logged", async () => {
    const report: FlipReportStub = {
      findMany: vi.fn().mockResolvedValue([
        { id: "s1", periodStart: W, periodEnd: W_END },
        { id: "s2", periodStart: W, periodEnd: W_END },
      ]),
      // s1 flips first (commits); s2 then collides on the now-open boundary.
      updateMany: vi
        .fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockRejectedValueOnce(openBoundaryP2002()),
      // the re-read after s2's P2002 finds s1, now open.
      findFirst: vi.fn().mockResolvedValue({ id: "s1" }),
    };
    const logger = { log: vi.fn(), warn: vi.fn() };

    await flipDueScheduledToOpen(asAny(report), now, logger);

    // Deterministic order: s1 then s2; exactly one update committed.
    expect(report.updateMany).toHaveBeenCalledTimes(2);
    expect(report.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "s1", periodState: "scheduled" },
      }),
    );
    expect(report.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "s2", periodState: "scheduled" },
      }),
    );
    // The duplicate (s2) is reported, never deleted.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("s2"));
  });

  it("re-throws a non-P2002 error (the tick aborts rather than silently swallowing)", async () => {
    const report: FlipReportStub = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "s1", periodStart: W, periodEnd: W_END }]),
      updateMany: vi.fn().mockRejectedValue(new Error("db down")),
      findFirst: vi.fn(),
    };

    await expect(
      flipDueScheduledToOpen(asAny(report), now, {
        log: vi.fn(),
        warn: vi.fn(),
      }),
    ).rejects.toThrow("db down");
    // No recovery re-read on an unrelated error.
    expect(report.findFirst).not.toHaveBeenCalled();
  });
});
