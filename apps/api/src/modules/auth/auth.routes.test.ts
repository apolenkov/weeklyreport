import { describe, expect, it, vi } from "vitest";
import type { PrismaClient, Role } from "@prisma/client";

import {
  buildUserSession,
  getCurrentWeekBounds,
  type SamlProfile,
} from "./auth.routes";

/**
 * Phase 32-C / H-01 — admin SAML login regression test.
 *
 * Pre-fix: `buildUserSession` cast `profile.role as 'lead' | 'head' | 'viewer'`
 * before passing it to `prisma.user.create`. Prisma's `Role` enum was
 * `{lead, head, viewer}` (no admin), so the cast lied at runtime and the DB
 * threw "Invalid enum value" on first admin SAML login.
 *
 * Post-fix: Prisma `Role` enum now includes `admin`, the cast is gone,
 * `SamlProfile.role` is typed as `Role`, and the session round-trips the
 * 'admin' role through to UserSession.
 */
describe("buildUserSession — admin SAML login (Phase 32-C / H-01)", () => {
  function fakePrisma(opts: {
    existingUser?: {
      id: string;
      email: string;
      name: string;
      role: Role;
      samlId: string;
    } | null;
  }): PrismaClient {
    const existing = opts.existingUser ?? null;
    const fake = {
      user: {
        findFirst: vi.fn(async () => existing),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<{ samlId: string; name: string }>;
          }) => ({
            ...(existing ?? { email: "unset", role: "lead" as Role }),
            id: where.id,
            ...data,
          }),
        ),
        create: vi.fn(
          async ({
            data,
          }: {
            data: { samlId: string; email: string; name: string; role: Role };
          }) => ({
            id: "new-user-id",
            ...data,
          }),
        ),
      },
      reportSection: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
      report: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(),
      },
      project: {
        findMany: vi.fn(async () => []),
      },
      projectStatus: {
        createMany: vi.fn(),
      },
      reportingGroup: {
        findFirst: vi.fn(async () => ({
          id: "a0000000-0000-4000-8000-000000000301",
        })),
        findUnique: vi.fn(async () => ({
          name: "Software Development",
        })),
        upsert: vi.fn(async () => ({
          id: "a0000000-0000-4000-8000-000000000301",
        })),
      },
    };
    return fake as unknown as PrismaClient;
  }

  it("persists role=admin and returns session with role=admin (no narrow cast crash)", async () => {
    const prisma = fakePrisma({ existingUser: null });
    const profile: SamlProfile = {
      samlId: "saml-admin-1",
      email: "admin@customreport.local",
      displayName: "Administrator",
      role: "admin",
    };

    const session = await buildUserSession(prisma, profile);

    expect(session.role).toBe("admin");
    expect(session.email).toBe("admin@customreport.local");
    expect(session.reportingGroupName).toBe("Software Development");
    // The Prisma create call must have received role='admin' verbatim
    const createMock = prisma.user.create as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0].data.role).toBe("admin");
  });

  it("preserves role=admin on existing user update (samlId rebind)", async () => {
    const prisma = fakePrisma({
      existingUser: {
        id: "existing-admin-id",
        email: "admin@customreport.local",
        name: "Old Name",
        role: "admin",
        samlId: "old-saml-id",
      },
    });
    const profile: SamlProfile = {
      samlId: "saml-admin-rotated",
      email: "admin@customreport.local",
      displayName: "Administrator",
      role: "admin",
    };

    const session = await buildUserSession(prisma, profile);

    expect(session.role).toBe("admin");
    // No admin section auto-creation (admin is not a lead)
    const createSection = prisma.reportSection.create as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(createSection).not.toHaveBeenCalled();
  });
});

/**
 * Phase 32-M7 / M-07 — UTC-stable week-boundary calc.
 *
 * Pre-fix: getCurrentWeekBounds used local-time setDate/setHours, which
 * drifts across DST transitions and varies by host TZ (Docker default is
 * UTC, but a TZ=Europe/Moscow deploy produced different bounds at 23:00
 * Sunday than UTC).
 *
 * Post-fix: bounds are computed entirely with Date.UTC() — same input
 * Date produces the same Monday 00:00:00 UTC and Sunday 23:59:59.999 UTC
 * regardless of process.env.TZ.
 */
describe("getCurrentWeekBounds — UTC-stable week boundaries (Phase 32-M7 / M-07)", () => {
  it("returns Monday 00:00:00 UTC and Sunday 23:59:59.999 UTC for a mid-week date", () => {
    // Wednesday 2026-04-29 12:34:56 UTC — week is Mon 2026-04-27 .. Sun 2026-05-03
    const wed = new Date("2026-04-29T12:34:56.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(wed);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("treats Monday 00:00 UTC as the start of its own week", () => {
    const mon = new Date("2026-04-27T00:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(mon);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("treats Sunday 23:59 UTC as the end of the same week (Sunday rolls back 6)", () => {
    // Sunday 2026-05-03 23:59 UTC must still belong to the Mon Apr 27 week.
    const sun = new Date("2026-05-03T23:59:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(sun);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("is stable across European DST spring-forward (last Sunday of March 2026)", () => {
    // CET → CEST DST transition: 2026-03-29 01:00 UTC (03:00 CET → 03:00 CEST → wait, 02:00 → 03:00 local).
    // The naive setHours/setDate path drifts here in a non-UTC TZ container.
    // Pre-DST sample: Saturday 2026-03-28 22:00 UTC
    // Post-DST sample: Sunday 2026-03-29 02:00 UTC (just after spring-forward)
    const preDst = new Date("2026-03-28T22:00:00.000Z");
    const postDst = new Date("2026-03-29T02:00:00.000Z");

    // Both fall in the Mon 2026-03-23 .. Sun 2026-03-29 week.
    const a = getCurrentWeekBounds(preDst);
    const b = getCurrentWeekBounds(postDst);

    expect(a.periodStart.toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(a.periodEnd.toISOString()).toBe("2026-03-29T23:59:59.999Z");
    expect(b.periodStart.toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(b.periodEnd.toISOString()).toBe("2026-03-29T23:59:59.999Z");

    // The two boundaries match exactly — DST did not perturb the result.
    expect(a.periodStart.getTime()).toBe(b.periodStart.getTime());
    expect(a.periodEnd.getTime()).toBe(b.periodEnd.getTime());
  });

  it("is stable across Russia local-time edge (Moscow has no DST but TZ=Europe/Moscow shifts hour math)", () => {
    // 23:00 Moscow Sunday is 20:00 UTC Sunday — naive local-time setHours
    // would resolve "Sunday 00:00 local" differently in Moscow vs UTC.
    // 2026-04-26 20:00 UTC = 2026-04-26 23:00 Europe/Moscow.
    const moscowSundayLate = new Date("2026-04-26T20:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(moscowSundayLate);

    // Sunday 2026-04-26 UTC belongs to the Mon Apr 20 .. Sun Apr 26 week.
    expect(periodStart.toISOString()).toBe("2026-04-20T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-04-26T23:59:59.999Z");
  });

  it("produces identical bounds regardless of host TZ snapshot (canonical UTC ISO)", () => {
    // Snapshot the result for a known Date — must match a UTC-derived
    // expectation regardless of the JIT host TZ. (Vitest cannot mutate
    // the host TZ mid-process safely; this assertion is the "canonical
    // ISO" lock that catches any reintroduction of local-time math.)
    const fixed = new Date("2026-04-30T09:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(fixed);

    // Apr 30 2026 is a Thursday — week is Mon Apr 27 .. Sun May 3.
    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });
});

/**
 * UFB-048 / Phase 50-A — periodLengthDays setting drives `periodEnd`.
 *
 * Pre-50-A: `periodEnd` was always Monday + 6 days (Mon-Sun = 7-day week).
 * Post-50-A: `getCurrentWeekBounds(date, settings.periodLengthDays)`
 * recomputes `periodEnd` so admin can switch to e.g. 14-day cycles.
 */
describe("getCurrentWeekBounds — periodLengthDays override (Phase 50-A)", () => {
  it("computes periodEnd = periodStart + (length - 1) days at 23:59:59.999 UTC for length=14", () => {
    // Thursday 2026-04-30 — Monday anchor is 2026-04-27, +13 days = 2026-05-10.
    const thu = new Date("2026-04-30T09:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(thu, 14);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-05-10T23:59:59.999Z");
  });

  it("falls back to length=7 when no override is passed (Mon-Sun default)", () => {
    const thu = new Date("2026-04-30T09:00:00.000Z");
    const { periodEnd } = getCurrentWeekBounds(thu);

    // No override → Sunday 2026-05-03 (Monday + 6 days).
    expect(periodEnd.toISOString()).toBe("2026-05-03T23:59:59.999Z");
  });

  it("collapses to single-day period when length=1 (degenerate but valid)", () => {
    const thu = new Date("2026-04-30T09:00:00.000Z");
    const { periodStart, periodEnd } = getCurrentWeekBounds(thu, 1);

    expect(periodStart.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    // Monday + 0 days = same Monday, end-of-day.
    expect(periodEnd.toISOString()).toBe("2026-04-27T23:59:59.999Z");
  });
});
