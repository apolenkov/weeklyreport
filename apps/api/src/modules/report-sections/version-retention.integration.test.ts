/**
 * Integration tests for time-based version-snapshot retention.
 *
 * Retention policy (runs inside createVersionSnapshot after each create):
 *   0–24 h    → keep all
 *   24 h–7 d  → keep newest per clock-hour
 *   7 d–30 d  → keep newest per calendar-day
 *   > 30 d    → delete all (unless pinned = true)
 *   pinned    → never deleted regardless of age
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";

describe("LeadFormPrismaRepository — time-based retention", () => {
  const prisma = createTestPrisma();
  let repo: LeadFormPrismaRepository;
  let sectionId: string;

  beforeAll(() => {
    repo = new LeadFormPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const testData = await seedTestData(prisma);
    sectionId = testData.section.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  /** Insert a snapshot bypassing the @default(now()) so we can control the age. */
  async function insertAt(version: number, createdAt: Date, pinned = false) {
    await prisma.$executeRaw`
      INSERT INTO "VersionSnapshot" (id, "reportSectionId", version, data, "createdAt", pinned)
      VALUES (gen_random_uuid()::text, ${sectionId}, ${version}, '{"items":[],"risks":[],"decisions":[],"stageStatuses":[]}', ${createdAt}, ${pinned})
    `;
  }

  function hoursAgo(h: number): Date {
    return new Date(Date.now() - h * 60 * 60 * 1000);
  }

  function daysAgo(d: number): Date {
    return hoursAgo(d * 24);
  }

  it("keeps all snapshots inside the 24-hour window", async () => {
    await insertAt(1, hoursAgo(23));
    await insertAt(2, hoursAgo(12));
    await insertAt(3, hoursAgo(1));

    // This creates v4 and runs cleanup
    await repo.createVersionSnapshot(sectionId);

    const count = await prisma.versionSnapshot.count({
      where: { reportSectionId: sectionId },
    });
    expect(count).toBe(4); // 3 old + 1 new
  });

  it("keeps only the newest snapshot per clock-hour in the 24h–7d window", async () => {
    // Anchor all three to the same UTC hour (3 days + 2 hours ago) to avoid
    // hour-boundary flakiness. Use :10, :20, :50 within that hour.
    const hourStart = new Date(Date.now() - (3 * 24 + 2) * 3_600_000);
    hourStart.setUTCMinutes(0, 0, 0);
    const sameHour = (m: number) =>
      new Date(hourStart.getTime() + m * 60_000);

    await insertAt(1, sameHour(10)); // HH:10 — oldest
    await insertAt(2, sameHour(20)); // HH:20
    await insertAt(3, sameHour(50)); // HH:50 — newest in this hour → survives

    await repo.createVersionSnapshot(sectionId);

    const snapshots = await prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { version: "asc" },
      select: { version: true },
    });
    // Only v3 (newest per hour) + the freshly created one should remain
    const versions = snapshots.map((s) => s.version);
    expect(versions).toContain(3); // newest of the three old ones
    expect(versions).not.toContain(1);
    expect(versions).not.toContain(2);
    expect(snapshots).toHaveLength(2);
  });

  it("keeps only the newest snapshot per calendar-day in the 7d–30d window", async () => {
    // Anchor all three to the same UTC day (10 days ago) to avoid
    // midnight-boundary flakiness when daysAgo fractions straddle midnight.
    const dayStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    dayStart.setUTCHours(0, 0, 0, 0);
    const sameDay = (h: number) =>
      new Date(dayStart.getTime() + h * 3_600_000);

    await insertAt(1, sameDay(8)); // 08:00 UTC — oldest
    await insertAt(2, sameDay(10)); // 10:00 UTC
    await insertAt(3, sameDay(12)); // 12:00 UTC — newest in this day → survives

    await repo.createVersionSnapshot(sectionId);

    const snapshots = await prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      orderBy: { version: "asc" },
      select: { version: true },
    });
    const versions = snapshots.map((s) => s.version);
    expect(versions).toContain(3);
    expect(versions).not.toContain(1);
    expect(versions).not.toContain(2);
    expect(snapshots).toHaveLength(2);
  });

  it("deletes all unpinned snapshots older than 30 days", async () => {
    await insertAt(1, daysAgo(31));
    await insertAt(2, daysAgo(35));

    await repo.createVersionSnapshot(sectionId);

    const count = await prisma.versionSnapshot.count({
      where: { reportSectionId: sectionId },
    });
    expect(count).toBe(1); // only the new snapshot
  });

  it("never deletes pinned snapshots regardless of age", async () => {
    await insertAt(1, daysAgo(31), false); // unpinned → should be deleted
    await insertAt(2, daysAgo(35), true); // pinned → must survive

    await repo.createVersionSnapshot(sectionId);

    const snapshots = await prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      select: { version: true },
      orderBy: { version: "asc" },
    });
    const versions = snapshots.map((s) => s.version);
    expect(versions).not.toContain(1); // unpinned >30d → deleted
    expect(versions).toContain(2); // pinned → never deleted
    expect(snapshots).toHaveLength(2); // pinned v2 + new snapshot
  });

  it("pinned snapshots in the 24h–7d window are preserved even though the rest of the hour is thinned", async () => {
    // Anchor all three to the same UTC hour (3 days + 3 hours ago) to avoid
    // boundary flakiness. v1 and v3 are unpinned; v2 is pinned.
    const hourStart = new Date(Date.now() - (3 * 24 + 3) * 3_600_000);
    hourStart.setUTCMinutes(0, 0, 0);
    const sameHour = (m: number) =>
      new Date(hourStart.getTime() + m * 60_000);

    await insertAt(1, sameHour(5), false); // HH:05 — unpinned, oldest → deleted
    await insertAt(2, sameHour(20), true); // HH:20 — PINNED → must survive
    await insertAt(3, sameHour(50)); // HH:50 — newest unpinned → survives as bucket winner

    await repo.createVersionSnapshot(sectionId);

    const snapshots = await prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      select: { version: true },
      orderBy: { version: "asc" },
    });
    const versions = snapshots.map((s) => s.version);
    expect(versions).toContain(2); // pinned must survive
    expect(versions).toContain(3); // newest unpinned in hour bucket
    expect(versions).not.toContain(1); // unpinned, older, same bucket
  });
});
