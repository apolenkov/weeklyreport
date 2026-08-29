import type {
  PeriodState,
  PeriodStatus,
  ReportStatus,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
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
  deadlineTime: "18:00",
};

// A Monday — getCurrentWeekBounds anchors the week to it, so the period is
// 2026-05-11 (Mon) .. 2026-05-17 (Sun) and the deadline is Fri 2026-05-15.
const ANCHOR_MONDAY = new Date("2026-05-11T09:00:00.000Z");
const EXPECTED_PERIOD_START = "2026-05-11T00:00:00.000Z";
const EXPECTED_PERIOD_END = "2026-05-17T23:59:59.999Z";
// Fri 2026-05-15 18:00 Europe/Moscow = 15:00 UTC.
const EXPECTED_DEADLINE = "2026-05-15T15:00:00.000Z";
const PUBLISHER_ID = "11111111-1111-4111-8111-111111111111";

interface PeriodRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  status: ReportStatus;
  periodState: PeriodState | null;
  periodStatus: PeriodStatus;
  archived: boolean;
  autoPublished: boolean;
  autoArchived: boolean;
  publishedAt: Date | null;
  publishedById: string | null;
  reopenedAt: Date | null;
}

function makePeriodRow(overrides: Partial<PeriodRow> = {}): PeriodRow {
  return {
    id: "period-existing",
    periodStart: new Date(EXPECTED_PERIOD_START),
    periodEnd: new Date(EXPECTED_PERIOD_END),
    deadline: new Date(EXPECTED_DEADLINE),
    status: "draft",
    periodState: "open",
    periodStatus: "open",
    archived: false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: null,
    publishedById: null,
    reopenedAt: null,
    ...overrides,
  };
}

// The factory types its `prisma` arg on the precise Prisma `report` delegate;
// tests pass a minimal stub through this seam (mirrors the scheduler test's
// `asAny`). The mocks are returned alongside so assertions stay typed.
type FactoryPrisma = Parameters<typeof ensureCurrentPeriod>[0];

// The real `create` payload type, kept in lock-step with the delegate so a
// Prisma-schema change breaks the test at compile time.
type ReportCreateData = Parameters<
  FactoryPrisma["report"]["create"]
>[0]["data"];

function makePrisma(opts: {
  existing?: PeriodRow | null;
  containing?: PeriodRow | null;
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

  const findMany = vi
    .fn()
    .mockResolvedValueOnce(opts.existing ? [opts.existing] : [])
    .mockResolvedValueOnce(opts.containing ? [opts.containing] : [])
    .mockResolvedValue(opts.raced ? [opts.raced] : []);

  const client = { report: { findMany, create } } as unknown as FactoryPrisma;
  return { client, create, findMany };
}

const P2002_OPEN_BOUNDARY = {
  code: "P2002",
  meta: { target: "Report_one_open_per_boundary" },
};

const P2039_PERIOD_OVERLAP = {
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
    expect(expectDefined(result.deadline).toISOString()).toBe(
      EXPECTED_DEADLINE,
    );

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

  it("uses the configured wall-clock deadline in the configured timezone", async () => {
    const { client } = makePrisma({ createdId: "period-custom-deadline" });

    const result = await ensureCurrentPeriod(
      client,
      ANCHOR_MONDAY,
      ANCHOR_MONDAY,
      {
        ...SETTINGS,
        defaultTimezone: "Asia/Tokyo",
        deadlineTime: "09:30",
      },
    );

    expect(expectDefined(result.deadline).toISOString()).toBe(
      "2026-05-15T00:30:00.000Z",
    );
  });

  it("is idempotent: returns the existing draft without creating", async () => {
    const { client, create, findMany } = makePrisma({
      existing: makePeriodRow(),
    });

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
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        periodStart: new Date(EXPECTED_PERIOD_START),
        periodEnd: new Date(EXPECTED_PERIOD_END),
      },
      select: {
        status: true,
        periodState: true,
        periodStatus: true,
        archived: true,
      },
    });
  });

  it("returns a valid scheduled row without coercion", async () => {
    const { client } = makePrisma({
      existing: makePeriodRow({ periodState: "scheduled" }),
    });

    await expect(
      ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
    ).resolves.toMatchObject({ created: false, periodState: "scheduled" });
  });

  it("returns a live manual range containing the anchor when no exact boundary exists", async () => {
    const containing = makePeriodRow({
      id: "period-manual-containing-anchor",
      periodStart: new Date("2026-05-05T00:00:00.000Z"),
      periodEnd: new Date("2026-05-18T23:59:59.999Z"),
    });
    const { client, create } = makePrisma({ containing });

    await expect(
      ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
    ).resolves.toMatchObject({
      created: false,
      reportId: "period-manual-containing-anchor",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "published",
      row: makePeriodRow({
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: ANCHOR_MONDAY,
        publishedById: PUBLISHER_ID,
      }),
    },
    {
      label: "archived",
      row: makePeriodRow({ periodState: "archived", archived: true }),
    },
  ])(
    "excludes a valid $label row and creates the live period",
    async ({ row }) => {
      const { client, create } = makePrisma({ existing: row });

      await expect(
        ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
      ).resolves.toMatchObject({ created: true, reportId: "period-new" });
      expect(create).toHaveBeenCalledOnce();
    },
  );

  it.each([
    {
      label: "null canonical state",
      row: makePeriodRow({ periodState: null }),
    },
    {
      label: "contradictory tuple",
      row: makePeriodRow({
        status: "published",
        periodState: "open",
        periodStatus: "published",
      }),
    },
  ])("rejects a contradictory $label row", async ({ row }) => {
    const { client, create } = makePrisma({ existing: row });

    await expect(
      ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
    ).rejects.toMatchObject({
      name: "PeriodLifecycleIntegrityError",
      message: "Stored period lifecycle is inconsistent.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("concurrent create (P2002 on the open-boundary index) re-reads and returns the winner", async () => {
    const raced = makePeriodRow({ id: "period-winner" });
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
    const raced = makePeriodRow({
      id: "period-scheduled-winner",
      periodState: "scheduled",
    });
    const { client, findMany } = makePrisma({
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
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          periodStart: new Date(EXPECTED_PERIOD_START),
          periodEnd: new Date(EXPECTED_PERIOD_END),
        },
      }),
    );
  });

  it("range-constraint collision on the exact boundary returns the winner", async () => {
    const raced = makePeriodRow({ id: "period-range-winner" });
    const { client } = makePrisma({
      createThrows: P2039_PERIOD_OVERLAP,
      raced,
    });

    await expect(
      ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
    ).resolves.toMatchObject({
      created: false,
      reportId: "period-range-winner",
    });
  });

  it("range-constraint collision on a distinct boundary fails with a typed overlap error", async () => {
    const { client } = makePrisma({ createThrows: P2039_PERIOD_OVERLAP });

    await expect(
      ensureCurrentPeriod(client, ANCHOR_MONDAY, ANCHOR_MONDAY, SETTINGS),
    ).rejects.toMatchObject({
      name: "PeriodOverlapError",
      message: "A reporting period overlaps an existing period.",
    });
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
    // handing it `now` — it does not blunt-skip the whole call when the deadline
    // has passed (that would drop still-future instants like a T+2h escalation).
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
    const { client } = makePrisma({ existing: makePeriodRow() });
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
