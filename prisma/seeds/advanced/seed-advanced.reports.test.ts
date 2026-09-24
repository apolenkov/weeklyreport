import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { HEAD_USER_ID, SEED_REPORTS } from "../support/seed-constants.js";
import {
  seedActiveReport,
  seedPublishedReport,
} from "./seed-advanced.reports.js";

interface CapturedUpsertArgs {
  where: { id: string };
  update: Record<string, unknown>;
  create: Record<string, unknown>;
}

function capturedReportUpsert() {
  const upsert = vi.fn();
  const prisma = {
    report: { upsert },
  } as unknown as PrismaClient;
  const calls = (): CapturedUpsertArgs[] =>
    upsert.mock.calls.map(([args]) => args as CapturedUpsertArgs);
  return { prisma, calls };
}

// Upsert update semantics: columns absent from `update` keep their stored
// values, so the merged row is what a rerun actually leaves behind.
function applyUpdate<T extends Record<string, unknown>>(
  stored: T,
  update: Record<string, unknown>,
): T {
  return { ...stored, ...update };
}

// A row left over from a published-then-reopened-then-archived cycle: every
// lifecycle companion field the writers must reset on rerun.
const staleStored = {
  id: SEED_REPORTS.active.id,
  status: "published",
  periodStatus: "reopened",
  periodState: "published",
  archived: true,
  autoPublished: true,
  autoArchived: true,
  publishedAt: new Date("2026-08-09T21:00:00.000Z"),
  publishedById: "a0000000-0000-4000-8000-000000000777",
  reopenedAt: new Date("2026-08-10T09:00:00.000Z"),
  publishedSnapshot: { reportId: SEED_REPORTS.active.id, stale: true },
};

describe("advanced report upsert lifecycle tuple", () => {
  it("clears stale publication and reopen state when restoring the active report", async () => {
    const { prisma, calls } = capturedReportUpsert();
    await seedActiveReport(prisma);

    const [call] = calls();
    expect(call?.where.id).toBe(SEED_REPORTS.active.id);
    const restored = applyUpdate({ ...staleStored }, call?.update ?? {});

    expect(restored.status).toBe("draft");
    expect(restored.periodStatus).toBe("open");
    expect(restored.periodState).toBe("open");
    expect(restored.archived).toBe(false);
    expect(restored.autoPublished).toBe(false);
    expect(restored.autoArchived).toBe(false);
    expect(restored.publishedAt).toBeNull();
    expect(restored.publishedById).toBeNull();
    expect(restored.reopenedAt).toBeNull();
    // DbNull writes SQL NULL; a JsonNull literal would read as present to
    // `publishedSnapshot: { not: Prisma.DbNull }` consumers.
    expect(restored.publishedSnapshot).toBe(Prisma.DbNull);
  });

  it("clears stale reopen and automation flags when restoring the published report", async () => {
    const { prisma, calls } = capturedReportUpsert();
    await seedPublishedReport(prisma);

    const [call] = calls();
    expect(call?.where.id).toBe(SEED_REPORTS.published.id);
    const restored = applyUpdate(
      { ...staleStored, id: SEED_REPORTS.published.id },
      call?.update ?? {},
    );

    expect(restored.status).toBe("published");
    expect(restored.periodStatus).toBe("published");
    expect(restored.periodState).toBe("published");
    expect(restored.archived).toBe(false);
    expect(restored.autoPublished).toBe(false);
    expect(restored.autoArchived).toBe(false);
    expect(restored.reopenedAt).toBeNull();
    expect(restored.publishedAt).toEqual(
      new Date(SEED_REPORTS.published.publishedAt),
    );
    expect(restored.publishedById).toBe(HEAD_USER_ID);
    expect(restored.publishedSnapshot).not.toBe(Prisma.DbNull);
    expect(restored.publishedSnapshot).not.toBe(Prisma.JsonNull);
  });
});
