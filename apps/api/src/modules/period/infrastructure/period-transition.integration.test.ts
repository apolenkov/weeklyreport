import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { applyTransition } from "../domain/period-transition.apply.js";

// ---------------------------------------------------------------------------
// refactor-period-transition-writer — the period-dual-state-required atomicity
// test. The whole point of the single transition writer is that the coupled
// lifecycle representations move together or not at all. These tests prove
// that against a real database:
//
//  1. A transition rolled back inside its $transaction leaves EVERY governed
//     field at its pre-transition value — no representation is half-written.
//  2. A committed transition writes the COMPLETE field set (all three machines
//     plus the audit flag move together).
// ---------------------------------------------------------------------------

const LIFECYCLE_SELECT = {
  periodState: true,
  status: true,
  periodStatus: true,
  archived: true,
  autoPublished: true,
  publishedAt: true,
  publishedById: true,
} as const;

describe("period transition atomicity (integration)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("a rolled-back transition leaves every governed field untouched", async () => {
    const reportId = testData.report.id;
    const before = await prisma.report.findUnique({
      where: { id: reportId },
      select: LIFECYCLE_SELECT,
    });

    await expect(
      prisma.$transaction(async (tx) => {
        // The transition write happens...
        await applyTransition(tx, reportId, "autoPublish", {
          now: new Date("2026-04-12T10:00:00.000Z"),
        });
        // ...then the surrounding work fails, rolling the whole tx back. This
        // mirrors the real hazard the change closes: a publish that cannot be
        // left half-applied.
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow("forced rollback");

    const after = await prisma.report.findUnique({
      where: { id: reportId },
      select: LIFECYCLE_SELECT,
    });

    // Neither periodState nor the legacy fields were partially updated.
    expect(after).toEqual(before);
  });

  it("a committed transition writes the complete autoPublish field set", async () => {
    const reportId = testData.report.id;

    await prisma.$transaction((tx) =>
      applyTransition(tx, reportId, "autoPublish", {
        now: new Date("2026-04-12T10:00:00.000Z"),
      }),
    );

    const after = expectDefined(
      await prisma.report.findUnique({
        where: { id: reportId },
        select: LIFECYCLE_SELECT,
      }),
    );

    // All three lifecycle machines + the audit flag moved together.
    expect(after.status).toBe("published");
    expect(after.periodStatus).toBe("published");
    expect(after.periodState).toBe("published");
    expect(after.archived).toBe(false);
    expect(after.autoPublished).toBe(true);
    expect(after.publishedAt).toEqual(new Date("2026-04-12T10:00:00.000Z"));
    expect(after.publishedById).toBeNull();
  });
});
