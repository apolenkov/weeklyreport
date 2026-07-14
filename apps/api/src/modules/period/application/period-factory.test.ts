import type { ReportStatus } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  ensureCurrentPeriod,
  type PeriodFactorySettings,
} from "./period-factory.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SETTINGS: PeriodFactorySettings = {
  periodLengthDays: 7,
  defaultDeadlineDays: 4,
  workingDays: "mon-fri",
  defaultTimezone: "Europe/Moscow",
};

// A Monday — getCurrentWeekBounds anchors the week to it, so the period is
// 2026-05-11 (Mon) .. 2026-05-17 (Sun) and the deadline is Fri 2026-05-15.
const ANCHOR_MONDAY = new Date("2026-05-11T09:00:00.000Z");
const EXPECTED_PERIOD_START = "2026-05-11T00:00:00.000Z";
const EXPECTED_PERIOD_END = "2026-05-17T23:59:59.999Z";
// Fri 2026-05-15 18:00 Europe/Moscow = 15:00 UTC.
const EXPECTED_DEADLINE = "2026-05-15T15:00:00.000Z";

interface PeriodRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  periodState: "scheduled" | "open";
}

interface ReportCreateData {
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  periodState: "scheduled" | "open";
  status: ReportStatus;
  archived: boolean;
}

// The factory types its `prisma` arg on the precise Prisma `report` delegate;
// tests pass a minimal stub through this seam (mirrors the scheduler test's
// `asAny`). The mocks are returned alongside so assertions stay typed.
type FactoryPrisma = Parameters<typeof ensureCurrentPeriod>[0];

function makePrisma(opts: {
  existing?: PeriodRow | null;
  raced?: PeriodRow | null;
  createThrows?: unknown;
  createdId?: string;
}) {
  const create = vi
    .fn()
    .mockImplementation(({ data }: { data: ReportCreateData }) => {
      if (opts.createThrows) throw opts.createThrows;
      return {
        id: opts.createdId ?? "period-new",
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        deadline: data.deadline,
        periodState: data.periodState,
      };
    });

  const findFirst = vi
    .fn()
    .mockImplementation((args: { where: { status?: string } }) =>
      // The by-bounds find filters on status:"draft"; the race re-read filters
      // on the live period states (no status key).
      args.where.status === "draft"
        ? (opts.existing ?? null)
        : (opts.raced ?? null),
    );

  const client = { report: { findFirst, create } } as unknown as FactoryPrisma;
  return { client, create, findFirst };
}

const P2002_OPEN_BOUNDARY = {
  code: "P2002",
  meta: { target: "Report_one_open_per_boundary" },
};

function makeApplicator() {
  return {
    applyToPeriod: vi
      .fn()
      .mockResolvedValue({ created: 0, updated: 0, skipped: 0 }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ensureCurrentPeriod", () => {
  it("creates via buildTransition with the computed deadline (both lifecycle reps set)", async () => {
    const { client, create } = makePrisma({ createdId: "period-created" });

    const result = await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      ANCHOR_MONDAY,
      SETTINGS,
    );

    expect(result).toMatchObject({
      created: true,
      reportId: "period-created",
      periodState: "open",
    });
    expect(result.periodStart.toISOString()).toBe(EXPECTED_PERIOD_START);
    expect(result.periodEnd.toISOString()).toBe(EXPECTED_PERIOD_END);
    expect(result.deadline.toISOString()).toBe(EXPECTED_DEADLINE);

    // The create data carries the full governed lifecycle field set from
    // buildTransition (periodState + the legacy draft/false tuple), not a
    // hand-assembled subset.
    const createArg = create.mock.calls[0]?.[0] as { data: ReportCreateData };
    expect(createArg.data).toMatchObject({
      periodState: "open",
      status: "draft",
      archived: false,
    });
  });

  it("is idempotent: returns the existing draft without creating", async () => {
    const existing: PeriodRow = {
      id: "period-existing",
      periodStart: new Date(EXPECTED_PERIOD_START),
      periodEnd: new Date(EXPECTED_PERIOD_END),
      deadline: new Date(EXPECTED_DEADLINE),
      periodState: "open",
    };
    const { client, create } = makePrisma({ existing });

    const result = await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      ANCHOR_MONDAY,
      SETTINGS,
    );

    expect(result).toMatchObject({
      created: false,
      reportId: "period-existing",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("concurrent create (P2002 on the open-boundary index) re-reads and returns the winner", async () => {
    const raced: PeriodRow = {
      id: "period-winner",
      periodStart: new Date(EXPECTED_PERIOD_START),
      periodEnd: new Date(EXPECTED_PERIOD_END),
      deadline: new Date(EXPECTED_DEADLINE),
      periodState: "open",
    };
    const { client, create } = makePrisma({
      createThrows: P2002_OPEN_BOUNDARY,
      raced,
    });

    const result = await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      ANCHOR_MONDAY,
      SETTINGS,
    );

    expect(result).toMatchObject({ created: false, reportId: "period-winner" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("concurrent scheduled create re-reads and returns the scheduled winner", async () => {
    const raced: PeriodRow = {
      id: "period-scheduled-winner",
      periodStart: new Date(EXPECTED_PERIOD_START),
      periodEnd: new Date(EXPECTED_PERIOD_END),
      deadline: new Date(EXPECTED_DEADLINE),
      periodState: "scheduled",
    };
    const { client, findFirst } = makePrisma({
      createThrows: P2002_OPEN_BOUNDARY,
      raced,
    });

    const result = await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      new Date("2026-05-10T09:00:00.000Z"),
      SETTINGS,
    );

    expect(result).toMatchObject({
      created: false,
      reportId: "period-scheduled-winner",
      periodState: "scheduled",
    });
    expect(findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          periodStart: new Date(EXPECTED_PERIOD_START),
          periodEnd: new Date(EXPECTED_PERIOD_END),
          periodState: { in: ["scheduled", "open"] },
        },
      }),
    );
  });

  it("re-throws a non-boundary error from create", async () => {
    const other = { code: "P2003", meta: { target: "something_else" } };
    const { client } = makePrisma({ createThrows: other });

    await expect(
      ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
    ).rejects.toBe(other);
  });

  it("applies reminder policy on create, passing `now` so the applicator can drop elapsed instants", async () => {
    const now = ANCHOR_MONDAY; // well before the Friday deadline
    const { client } = makePrisma({ createdId: "period-fut" });
    const policyApplicator = makeApplicator();

    await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      now,
      SETTINGS,
      policyApplicator,
    );

    expect(policyApplicator.applyToPeriod).toHaveBeenCalledTimes(1);
    // The factory delegates the elapsed-fireAt decision to the applicator by
    // handing it `now` — it no longer blunt-skips the whole call when the
    // deadline has passed (that would drop still-future instants like a T+2h
    // escalation). Per-rule elapsed-skip is covered in the applicator's tests.
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ id: "period-fut" }),
      now,
    );
  });

  it("still calls applyToPeriod (with now) when the period is created after its deadline", async () => {
    const lateNow = new Date("2026-05-18T00:00:00.000Z"); // past the Friday deadline
    const { client, create } = makePrisma({ createdId: "period-late" });
    const policyApplicator = makeApplicator();

    await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      lateNow,
      SETTINGS,
      policyApplicator,
    );

    expect(create).toHaveBeenCalledTimes(1);
    // The applicator is still invoked — it (not the factory) decides per rule
    // which instants are elapsed, so a still-future escalation is not lost.
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ id: "period-late" }),
      lateNow,
    );
  });

  it("best-effort: a failing applyToPeriod does NOT fail period creation", async () => {
    const { client } = makePrisma({ createdId: "period-besteffort" });
    const policyApplicator = {
      applyToPeriod: vi.fn().mockRejectedValue(new Error("reminders DB down")),
    };

    // The period is the durable artifact — a reminder-materialisation failure
    // must not propagate (it would 500 a login). It is logged and left for the
    // backfill command.
    const result = await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      ANCHOR_MONDAY,
      SETTINGS,
      policyApplicator,
    );

    expect(result).toMatchObject({
      created: true,
      reportId: "period-besteffort",
    });
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledTimes(1);
  });

  it("does NOT apply reminder policy on the found (idempotent) branch", async () => {
    const existing: PeriodRow = {
      id: "period-existing",
      periodStart: new Date(EXPECTED_PERIOD_START),
      periodEnd: new Date(EXPECTED_PERIOD_END),
      deadline: new Date(EXPECTED_DEADLINE),
      periodState: "open",
    };
    const { client } = makePrisma({ existing });
    const policyApplicator = makeApplicator();

    await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      ANCHOR_MONDAY,
      SETTINGS,
      policyApplicator,
    );

    expect(policyApplicator.applyToPeriod).not.toHaveBeenCalled();
  });
});
