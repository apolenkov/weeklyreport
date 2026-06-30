import type { AppSettings } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import {
  flipDueScheduledToOpen,
  PeriodCreatorScheduler,
} from "./period-creator.scheduler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // UFB-051 period-cycle knobs at SQL defaults. The creator reads
    // `periodLengthDays` / `defaultDeadlineDays` / `workingDays`.
    deadlineTime: "18:00",
    allowReopenAfterPublish: true,
    reopenWindowHours: 72,
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
    // period-uniqueness: the SCHEDULED→OPEN flip now reads the due scheduled
    // rows and flips them one at a time (was a single bulk updateMany).
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function makePrismaStub(opts: {
  mostRecent: { id: string; periodEnd: Date } | null;
  createdId?: string;
  // A pre-existing draft in the factory's target window (defaults to none).
  // refactor-auth-exemplary-layering: the scheduler now creates via the period
  // factory, which does a find-by-bounds before creating; the most-recent
  // lookup (orderBy) and that find share the `report.findFirst` mock, so the
  // stub branches on whether the call carries an `orderBy`.
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
          // UFB-053: echo the periodState the scheduler wrote so the
          // returned shape matches the real prisma client surface.
          periodState: data.periodState,
        })),
      // period-uniqueness: the flip reads due scheduled rows then updates each.
      // The runOnce-level tests exercise the create/skip paths, so the default
      // is "no due scheduled rows" — the flip is a no-op. The flip's own
      // recovery is covered by the focused flipDueScheduledToOpen tests below.
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// Cast to never via Nest DI seam — the scheduler types its constructor on
// PrismaService + AdminService; tests pass a minimal shape with only the
// methods exercised.
const asAny = <T>(x: unknown): T => x as T;

// ---------------------------------------------------------------------------
// Tests — three per processor (skip-when-disabled, fire-when-eligible,
// idempotent)
// ---------------------------------------------------------------------------

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
    // UFB-053: state column written on create; here periodStart is "this
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

  it("UFB-053: runs the SCHEDULED→OPEN flip (reads due scheduled rows) at the top of the tick", async () => {
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

  it("TD-06: policyApplicator.applyToPeriod called once when period is created", async () => {
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
      undefined,
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

// ---------------------------------------------------------------------------
// flipDueScheduledToOpen — per-boundary SCHEDULED→OPEN recovery (D5)
// ---------------------------------------------------------------------------

const W = new Date("2026-05-11T00:00:00.000Z");
const W_END = new Date("2026-05-17T23:59:59.999Z");

/** A Prisma P2002 carrying the open-boundary index name in `meta.target`. */
function openBoundaryP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: "Report_one_open_per_boundary" },
  });
}

interface FlipReportStub {
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
}

describe("flipDueScheduledToOpen", () => {
  const now = new Date("2026-05-12T00:05:00.000Z");

  it("(a) a boundary another writer already opened is skipped, the duplicate scheduled row is left + logged", async () => {
    const report: FlipReportStub = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "s1", periodStart: W, periodEnd: W_END }]),
      update: vi.fn().mockRejectedValue(openBoundaryP2002()),
      findFirst: vi.fn().mockResolvedValue({ id: "open-existing" }),
    };
    const warn = vi.fn();

    await flipDueScheduledToOpen(asAny(report), now, { warn });

    expect(report.update).toHaveBeenCalledTimes(1);
    // recovery re-read keys on the boundary + periodState='open'
    expect(report.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodStart: W, periodEnd: W_END, periodState: "open" },
        select: { id: true },
      }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("already open"));
  });

  it("(b) two scheduled rows on one boundary → exactly one opens, the other is left scheduled + logged", async () => {
    const report: FlipReportStub = {
      findMany: vi.fn().mockResolvedValue([
        { id: "s1", periodStart: W, periodEnd: W_END },
        { id: "s2", periodStart: W, periodEnd: W_END },
      ]),
      // s1 flips first (commits); s2 then collides on the now-open boundary.
      update: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(openBoundaryP2002()),
      // the re-read after s2's P2002 finds s1, now open.
      findFirst: vi.fn().mockResolvedValue({ id: "s1" }),
    };
    const warn = vi.fn();

    await flipDueScheduledToOpen(asAny(report), now, { warn });

    // Deterministic order: s1 then s2; exactly one update committed.
    expect(report.update).toHaveBeenCalledTimes(2);
    expect(report.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: "s1" } }),
    );
    expect(report.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: "s2" } }),
    );
    // The duplicate (s2) is reported, never deleted.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("s2"));
  });

  it("re-throws a non-P2002 error (the tick aborts rather than silently swallowing)", async () => {
    const report: FlipReportStub = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "s1", periodStart: W, periodEnd: W_END }]),
      update: vi.fn().mockRejectedValue(new Error("db down")),
      findFirst: vi.fn(),
    };

    await expect(
      flipDueScheduledToOpen(asAny(report), now, { warn: vi.fn() }),
    ).rejects.toThrow("db down");
    // No recovery re-read on an unrelated error.
    expect(report.findFirst).not.toHaveBeenCalled();
  });
});
