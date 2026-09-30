import type { AppSettings } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  createRepository,
  defaultSettings,
  initialSnapshot,
} from "./__tests__/focused-admin-harness.js";
import {
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  type AdminRepository,
  type PeriodRowFromRepo,
} from "./admin-shared.js";
import { PeriodAdminService } from "./period-admin.service.js";

const PERIOD_ID_OPEN = "11111111-1111-4111-8111-111111111101";
const PERIOD_ID_PUBLISHED_FRESH = "11111111-1111-4111-8111-111111111102";
const PERIOD_ID_PUBLISHED_STALE = "11111111-1111-4111-8111-111111111103";
const PERIOD_ID_ARCHIVED = "11111111-1111-4111-8111-111111111104";

function periodFixture(
  id: string,
  state: PeriodRowFromRepo["periodState"],
  overrides: Partial<PeriodRowFromRepo> = {},
): PeriodRowFromRepo {
  return {
    id,
    periodStart: new Date("2026-05-04T00:00:00Z"),
    periodEnd: new Date("2026-05-10T23:59:59Z"),
    deadline: new Date("2026-05-09T18:00:00Z"),
    publishedAt: state === "published" ? new Date() : null,
    periodState: state,
    periodStatus:
      state === "published" || state === "archived" ? "published" : "open",
    archived: state === "archived",
    autoPublished: false,
    autoArchived: state === "archived",
    submittedCount: 0,
    totalCount: 6,
    weekLabel: null,
    ...overrides,
  };
}

import type { PeriodState } from "@customreport/shared";
import { createNullLogger } from "../../lib/logger";

function makePeriodAwareRepository(
  rows: PeriodRowFromRepo[],
  settings: AppSettings = defaultSettings,
): AdminRepository {
  const base = createRepository(initialSnapshot, settings);
  const store = rows.map((r) => ({ ...r }));
  return {
    ...base,
    listPeriodsByState(filter) {
      return Promise.resolve(
        store
          .filter((r) => filter.states.includes(r.periodState))
          .slice(0, filter.limit)
          .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime()),
      );
    },
    archivePeriod(periodId) {
      const row = store.find((r) => r.id === periodId);
      if (!row) return Promise.reject(new Error("not found"));
      row.archived = true;
      row.periodState = "archived";
      return Promise.resolve();
    },
    unarchivePeriod(
      periodId,
      now = new Date(),
    ): Promise<{ nextPeriodState: PeriodState }> {
      const row = store.find((r) => r.id === periodId);
      if (!row) return Promise.reject(new Error("not found"));
      const next: PeriodState =
        row.periodStatus === "published"
          ? "published"
          : row.periodStart.getTime() > now.getTime()
            ? "scheduled"
            : "open";
      row.archived = false;
      row.periodState = next;
      return Promise.resolve({ nextPeriodState: next });
    },
  };
}

describe("PeriodAdminService — listPeriodsByState", () => {
  it("returns empty when the repository has no matching rows", async () => {
    const service = new PeriodAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );
    const result = await service.listPeriodsByState({ bucket: "active" });
    expect(result).toEqual([]);
  });

  it("active bucket fans out to scheduled+open+published", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published", {
      publishedAt: new Date(Date.now() - 2 * 3_600_000), // 2h ago
      periodStart: new Date("2026-05-04T00:00:00Z"),
    });
    const open = periodFixture(PERIOD_ID_OPEN, "open", {
      periodStart: new Date("2026-05-11T00:00:00Z"),
    });
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived");
    const service = new PeriodAdminService(
      makePeriodAwareRepository([fresh, open, archived]),
      createNullLogger(),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(PERIOD_ID_OPEN);
    expect(ids).toContain(PERIOD_ID_PUBLISHED_FRESH);
    expect(ids).not.toContain(PERIOD_ID_ARCHIVED);
  });

  it("archive bucket only contains archived rows", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published");
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived");
    const service = new PeriodAdminService(
      makePeriodAwareRepository([fresh, archived]),
      createNullLogger(),
    );

    const rows = await service.listPeriodsByState({ bucket: "archive" });
    expect(rows.map((r) => r.id)).toEqual([PERIOD_ID_ARCHIVED]);
  });

  it("canReopen is true for published rows within window", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published", {
      publishedAt: new Date(Date.now() - 2 * 3_600_000), // 2h ago
    });
    const service = new PeriodAdminService(
      makePeriodAwareRepository([fresh], {
        ...defaultSettings,
        allowReopenAfterPublish: true,
        reopenWindowHours: 72,
      }),
      createNullLogger(),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    const row = rows.find((r) => r.id === PERIOD_ID_PUBLISHED_FRESH);
    expect(row?.canReopen).toBe(true);
  });

  it("canReopen is false for published rows outside window", async () => {
    const stale = periodFixture(PERIOD_ID_PUBLISHED_STALE, "published", {
      publishedAt: new Date(Date.now() - 100 * 3_600_000), // 100h ago
    });
    const service = new PeriodAdminService(
      makePeriodAwareRepository([stale], {
        ...defaultSettings,
        allowReopenAfterPublish: true,
        reopenWindowHours: 72,
      }),
      createNullLogger(),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    expect(rows[0]?.canReopen).toBe(false);
  });

  it("canReopen is false when allowReopenAfterPublish=false (master switch)", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published", {
      publishedAt: new Date(Date.now() - 2 * 3_600_000),
    });
    const service = new PeriodAdminService(
      makePeriodAwareRepository([fresh], {
        ...defaultSettings,
        allowReopenAfterPublish: false,
        reopenWindowHours: 72,
      }),
      createNullLogger(),
    );

    const rows = await service.listPeriodsByState({ bucket: "active" });
    expect(rows[0]?.canReopen).toBe(false);
  });

  it("canArchive is true for published not-yet-archived rows", async () => {
    const fresh = periodFixture(PERIOD_ID_PUBLISHED_FRESH, "published");
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived");
    const service = new PeriodAdminService(
      makePeriodAwareRepository([fresh, archived]),
      createNullLogger(),
    );
    const active = await service.listPeriodsByState({ bucket: "active" });
    expect(active[0]?.canArchive).toBe(true);
    const archive = await service.listPeriodsByState({ bucket: "archive" });
    expect(archive[0]?.canArchive).toBe(false);
  });

  it("limit is clamped between 1 and 200", async () => {
    const rows = Array.from({ length: 201 }, (_, index) =>
      periodFixture(crypto.randomUUID(), "published", {
        periodStart: new Date(Date.UTC(2026, 0, index + 1)),
      }),
    );
    const service = new PeriodAdminService(
      makePeriodAwareRepository(rows),
      createNullLogger(),
    );
    // Negative gets clamped to 1, then filtered (and the one row matches).
    const a = await service.listPeriodsByState({ bucket: "active", limit: 0 });
    expect(a).toHaveLength(1);
    const b = await service.listPeriodsByState({
      bucket: "active",
      limit: 1000,
    });
    expect(b).toHaveLength(200);
  });
});

describe("PeriodAdminService — archivePeriod / unarchivePeriod", () => {
  it("archivePeriod flips state + archived on the in-memory row", async () => {
    const open = periodFixture(PERIOD_ID_OPEN, "open");
    const repo = makePeriodAwareRepository([open]);
    const service = new PeriodAdminService(repo, createNullLogger());

    const result = await service.archivePeriod(PERIOD_ID_OPEN);
    expect(result).toEqual({ success: true });

    const rows = await service.listPeriodsByState({ bucket: "archive" });
    expect(rows.map((r) => r.id)).toContain(PERIOD_ID_OPEN);
  });

  it("unarchivePeriod returns the derived nextPeriodState", async () => {
    const archived = periodFixture(PERIOD_ID_ARCHIVED, "archived", {
      periodStatus: "published",
    });
    const service = new PeriodAdminService(
      makePeriodAwareRepository([archived]),
      createNullLogger(),
    );

    const result = await service.unarchivePeriod(PERIOD_ID_ARCHIVED);
    expect(result.success).toBe(true);
    expect(result.periodState).toBe("published");
  });

  it("unarchivePeriod restores a future draft as scheduled at the supplied time", async () => {
    const future = periodFixture(PERIOD_ID_ARCHIVED, "archived", {
      periodStatus: "open",
      periodStart: new Date("2026-09-07T00:00:00Z"),
    });
    const service = new PeriodAdminService(
      makePeriodAwareRepository([future]),
      createNullLogger(),
      () => new Date("2026-08-31T12:00:00Z"),
    );

    const result = await service.unarchivePeriod(PERIOD_ID_ARCHIVED);

    expect(result).toEqual({ success: true, periodState: "scheduled" });
  });
});

function makeCreatePeriodRepository(opts: {
  seedPeriods?: { id: string; periodStart: Date; periodEnd: Date }[];
  settings?: AppSettings;
}): AdminRepository & {
  // Test-only inspector for the row the service asked the repo to mint.
  readLastCreated(): {
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: string;
  } | null;
} {
  const base = createRepository(
    initialSnapshot,
    opts.settings ?? defaultSettings,
  );
  const seed = [...(opts.seedPeriods ?? [])];
  let lastCreated: ReturnType<
    ReturnType<typeof makeCreatePeriodRepository>["readLastCreated"]
  > = null;
  let counter = 0;
  return {
    ...base,
    findOverlappingPeriod(input) {
      // Closed-interval overlap includes touching endpoints.
      const hit = seed
        .filter(
          (p) =>
            p.periodStart.getTime() <= input.periodEnd.getTime() &&
            p.periodEnd.getTime() >= input.periodStart.getTime(),
        )
        .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
        .at(0);
      return Promise.resolve(
        hit
          ? {
              id: hit.id,
              periodStart: hit.periodStart,
              periodEnd: hit.periodEnd,
            }
          : null,
      );
    },
    createPeriodManual(input) {
      counter += 1;
      const id = `11111111-1111-4111-8111-1111111110${String(counter).padStart(
        2,
        "0",
      )}`;
      lastCreated = {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        weekLabel: input.weekLabel,
        periodState: input.periodState,
      };
      seed.push({
        id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      });
      return Promise.resolve({
        id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        periodState: input.periodState,
      });
    },
    readLastCreated() {
      return lastCreated;
    },
  };
}

describe("PeriodAdminService — createPeriodManual", () => {
  it("happy path: mints a period with the supplied non-Monday periodStart", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new PeriodAdminService(repo, createNullLogger());

    const result = await service.createPeriodManual(
      {
        periodStart: new Date("2026-05-20T00:00:00.000Z"),
      },
      // Pin `now` to BEFORE periodStart so the initial state is
      // deterministic ('scheduled').
      { now: new Date("2026-05-11T12:00:00.000Z") },
    );

    expect(result.periodId).toMatch(/^[0-9a-f-]+$/);
    expect(result.periodStart.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    // periodEnd defaults to start + (periodLengthDays - 1) days + 23:59:59.999
    // for the configured 7-day periodLength.
    expect(result.periodEnd.toISOString()).toBe("2026-05-26T23:59:59.999Z");
    // Initial state derives from now-vs-start; periodStart is in the
    // future → 'scheduled'.
    expect(result.periodState).toBe("scheduled");
  });

  it("derives 'open' when periodStart is at or before now", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new PeriodAdminService(repo, createNullLogger());

    const result = await service.createPeriodManual(
      {
        periodStart: new Date("2026-05-04T00:00:00.000Z"),
      },
      { now: new Date("2026-05-11T12:00:00.000Z") },
    );
    expect(result.periodState).toBe("open");
  });

  it("D-8: accepts a custom period that starts on a non-Monday", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new PeriodAdminService(repo, createNullLogger());

    const result = await service.createPeriodManual(
      {
        periodStart: new Date("2026-05-19T00:00:00.000Z"),
      },
      { now: new Date("2026-05-11T12:00:00.000Z") },
    );

    expect(result.periodStart.toISOString()).toBe("2026-05-19T00:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-05-25T23:59:59.999Z");

    const last = repo.readLastCreated();
    expect(last?.periodStart.toISOString()).toBe("2026-05-19T00:00:00.000Z");
  });

  it("computes default deadline from AppSettings (defaultDeadlineDays + workingDays + deadlineTime)", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new PeriodAdminService(repo, createNullLogger());

    // defaultSettings: 5 business days mon-fri from Monday 2026-05-04 lands on
    // Monday 2026-05-11; 18:00 Europe/Moscow == 15:00 UTC. Same date math as
    // `computeDeadline` in business-date.ts.
    await service.createPeriodManual({
      periodStart: new Date("2026-05-04T00:00:00.000Z"),
    });

    const last = repo.readLastCreated();
    expect(last).not.toBeNull();
    expect(last?.deadline.toISOString()).toBe("2026-05-11T15:00:00.000Z");
  });

  it("respects explicit periodEnd / deadline / weekLabel overrides", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new PeriodAdminService(repo, createNullLogger());

    const explicitEnd = new Date("2026-05-31T23:59:59.999Z");
    const explicitDeadline = new Date("2026-05-29T15:00:00.000Z");
    await service.createPeriodManual({
      periodStart: new Date("2026-05-25T00:00:00.000Z"),
      periodEnd: explicitEnd,
      deadline: explicitDeadline,
      weekLabel: "Sprint 12 catch-up",
    });

    const last = repo.readLastCreated();
    expect(last?.periodEnd.toISOString()).toBe(explicitEnd.toISOString());
    expect(last?.deadline.toISOString()).toBe(explicitDeadline.toISOString());
    expect(last?.weekLabel).toBe("Sprint 12 catch-up");
  });

  it("rejects when [periodStart, periodEnd] overlaps an existing period", async () => {
    const repo = makeCreatePeriodRepository({
      seedPeriods: [
        {
          id: "existing",
          periodStart: new Date("2026-05-04T00:00:00.000Z"),
          periodEnd: new Date("2026-05-10T23:59:59.999Z"),
        },
      ],
    });
    const service = new PeriodAdminService(repo, createNullLogger());

    await expect(
      service.createPeriodManual({
        // Starts inside the existing period → overlap.
        periodStart: new Date("2026-05-08T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("rejects when periodEnd < periodStart", async () => {
    const repo = makeCreatePeriodRepository({});
    const service = new PeriodAdminService(repo, createNullLogger());

    await expect(
      service.createPeriodManual({
        periodStart: new Date("2026-05-18T00:00:00.000Z"),
        periodEnd: new Date("2026-05-10T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });
});

interface EditableRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  weekLabel: string | null;
  periodState: "scheduled" | "open" | "published" | "archived";
}

function makeUpdatePeriodRepository(opts: {
  // Pre-seeded periods used by both the read + overlap paths.
  seedPeriods: EditableRow[];
  settings?: AppSettings;
}): AdminRepository & {
  readLastUpdated(): {
    reportId: string;
    data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date | null;
      weekLabel?: string | null;
    };
  } | null;
} {
  const base = createRepository(
    initialSnapshot,
    opts.settings ?? defaultSettings,
  );
  const rows = new Map<string, EditableRow>(
    opts.seedPeriods.map((row) => [row.id, { ...row }]),
  );
  let lastUpdated: ReturnType<
    ReturnType<typeof makeUpdatePeriodRepository>["readLastUpdated"]
  > = null;
  return {
    ...base,
    findOverlappingPeriod(input) {
      // Closed-interval overlap with optional self-exclusion.
      const hit = [...rows.values()]
        .filter((row) => (input.excludeId ? row.id !== input.excludeId : true))
        .filter(
          (row) =>
            row.periodStart.getTime() <= input.periodEnd.getTime() &&
            row.periodEnd.getTime() >= input.periodStart.getTime(),
        )
        .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
        .at(0);
      return Promise.resolve(
        hit
          ? {
              id: hit.id,
              periodStart: hit.periodStart,
              periodEnd: hit.periodEnd,
            }
          : null,
      );
    },
    readPeriodById(periodId) {
      const row = rows.get(periodId);
      return Promise.resolve(row ? { ...row } : null);
    },
    updatePeriodManual(input) {
      const row = rows.get(input.reportId);
      if (!row) {
        return Promise.reject(new Error("test repo: row not found"));
      }
      const next: EditableRow = {
        ...row,
        ...(input.data.periodStart !== undefined
          ? { periodStart: input.data.periodStart }
          : {}),
        ...(input.data.periodEnd !== undefined
          ? { periodEnd: input.data.periodEnd }
          : {}),
        ...(input.data.deadline !== undefined
          ? { deadline: input.data.deadline }
          : {}),
        ...(input.data.weekLabel !== undefined
          ? { weekLabel: input.data.weekLabel }
          : {}),
      };
      rows.set(input.reportId, next);
      lastUpdated = { reportId: input.reportId, data: input.data };
      return Promise.resolve({ ...next });
    },
    readLastUpdated() {
      return lastUpdated;
    },
  };
}

const SEED_ROW_ID = "55555555-5555-4555-8555-555555555501";
const SEED_OTHER_ID = "55555555-5555-4555-8555-555555555502";

function defaultEditSeed(): EditableRow[] {
  return [
    {
      id: SEED_ROW_ID,
      periodStart: new Date("2026-05-04T00:00:00.000Z"),
      periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      deadline: new Date("2026-05-09T15:00:00.000Z"),
      weekLabel: "Sprint 11",
      periodState: "open",
    },
  ];
}

describe("PeriodAdminService — updatePeriodManual", () => {
  it("happy path: applies the diff and returns the updated row", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new PeriodAdminService(repo, createNullLogger());

    const { result, diff } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      deadline: new Date("2026-05-10T15:00:00.000Z"),
      weekLabel: "Sprint 11 (extended)",
    });

    expect(result.periodId).toBe(SEED_ROW_ID);
    expect(expectDefined(result.deadline).toISOString()).toBe(
      "2026-05-10T15:00:00.000Z",
    );
    expect(result.weekLabel).toBe("Sprint 11 (extended)");
    // Diff carries only the two changed fields.
    expect(Object.keys(diff).sort()).toEqual(["deadline", "weekLabel"]);
    expect(expectDefined(diff.deadline?.from).toISOString()).toBe(
      "2026-05-09T15:00:00.000Z",
    );
    expect(diff.weekLabel?.from).toBe("Sprint 11");
    // Repository write only carries the changed keys.
    const last = repo.readLastUpdated();
    expect(last?.reportId).toBe(SEED_ROW_ID);
    expect(Object.keys(last?.data ?? {}).sort()).toEqual([
      "deadline",
      "weekLabel",
    ]);
  });

  it("allows clearing weekLabel via explicit null", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new PeriodAdminService(repo, createNullLogger());

    const { result, diff } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      weekLabel: null,
    });

    expect(result.weekLabel).toBeNull();
    expect(diff.weekLabel).toEqual({ from: "Sprint 11", to: null });
  });

  it("rejects when reportId does not resolve", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new PeriodAdminService(repo, createNullLogger());

    await expect(
      service.updatePeriodManual({
        reportId: "00000000-0000-4000-8000-000000000000",
        deadline: new Date("2026-05-10T15:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodNotFoundError);
  });

  it("rejects when shifted envelope overlaps a DIFFERENT existing period", async () => {
    const repo = makeUpdatePeriodRepository({
      seedPeriods: [
        ...defaultEditSeed(),
        {
          id: SEED_OTHER_ID,
          periodStart: new Date("2026-05-11T00:00:00.000Z"),
          periodEnd: new Date("2026-05-17T23:59:59.999Z"),
          deadline: new Date("2026-05-16T15:00:00.000Z"),
          weekLabel: "Sprint 12",
          periodState: "scheduled",
        },
      ],
    });
    const service = new PeriodAdminService(repo, createNullLogger());

    // Try to push SEED_ROW_ID's end into the SEED_OTHER_ID window.
    await expect(
      service.updatePeriodManual({
        reportId: SEED_ROW_ID,
        periodEnd: new Date("2026-05-12T23:59:59.999Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("self-edit on the same envelope does NOT trigger overlap (excludeId works)", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new PeriodAdminService(repo, createNullLogger());

    // Shifting deadline only — envelope keys unchanged — should not even
    // touch the overlap gate. Then shift periodEnd to the same value
    // (a no-op for periodEnd, change deadline) → still safe.
    const { result } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      periodEnd: new Date("2026-05-10T23:59:59.999Z"), // same as seed
      deadline: new Date("2026-05-10T15:00:00.000Z"),
    });
    expect(expectDefined(result.deadline).toISOString()).toBe(
      "2026-05-10T15:00:00.000Z",
    );
  });

  it("no-op (zero changed fields) short-circuits without audit / write", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new PeriodAdminService(repo, createNullLogger());

    const { result, diff } = await service.updatePeriodManual({
      reportId: SEED_ROW_ID,
      // All values match the seed.
      periodStart: new Date("2026-05-04T00:00:00.000Z"),
      periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      deadline: new Date("2026-05-09T15:00:00.000Z"),
      weekLabel: "Sprint 11",
    });

    expect(diff).toEqual({});
    expect(result.periodId).toBe(SEED_ROW_ID);
    // Repository write skipped entirely.
    expect(repo.readLastUpdated()).toBeNull();
  });

  it("rejects when supplied periodEnd < periodStart", async () => {
    const repo = makeUpdatePeriodRepository({ seedPeriods: defaultEditSeed() });
    const service = new PeriodAdminService(repo, createNullLogger());

    await expect(
      service.updatePeriodManual({
        reportId: SEED_ROW_ID,
        periodStart: new Date("2026-05-20T00:00:00.000Z"),
        periodEnd: new Date("2026-05-19T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });
});
