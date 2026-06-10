/**
 * Integration tests for time-based version-snapshot retention.
 *
 * Retention policy (runs inside createVersionSnapshot after each create):
 *   0–24 h    → keep all
 *   24 h–7 d  → keep newest per clock-hour
 *   7 d–30 d  → keep newest per calendar-day
 *   > 30 d    → delete all
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

  /** Insert an autosave snapshot bypassing @default(now()) to control the age. */
  async function insertAt(version: number, createdAt: Date) {
    await prisma.$executeRaw`
      INSERT INTO "VersionSnapshot" (id, "reportSectionId", version, data, "createdAt")
      VALUES (gen_random_uuid()::text, ${sectionId}, ${version}, '{"items":[],"risks":[],"decisions":[],"stageStatuses":[]}', ${createdAt})
    `;
  }

  /** Insert a pinned snapshot bypassing @default(now()) to control the age. */
  async function insertPinnedAt(version: number, createdAt: Date) {
    await prisma.$executeRaw`
      INSERT INTO "VersionSnapshot" (id, "reportSectionId", version, data, kind, "createdAt")
      VALUES (gen_random_uuid()::text, ${sectionId}, ${version}, '{"items":[],"risks":[],"decisions":[],"stageStatuses":[]}', 'pinned', ${createdAt})
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
    const sameHour = (m: number) => new Date(hourStart.getTime() + m * 60_000);

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
    const sameDay = (h: number) => new Date(dayStart.getTime() + h * 3_600_000);

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

  it("deletes all snapshots older than 30 days", async () => {
    await insertAt(1, daysAgo(31));
    await insertAt(2, daysAgo(35));

    await repo.createVersionSnapshot(sectionId);

    const count = await prisma.versionSnapshot.count({
      where: { reportSectionId: sectionId },
    });
    expect(count).toBe(1); // only the new snapshot
  });

  // add-version-pin: pinned snapshots are retention-exempt (D3).

  it("never deletes a pinned snapshot older than 30 days", async () => {
    await insertPinnedAt(1, daysAgo(35));

    // createVersionSnapshot runs the retention sweep after creating a new row.
    await repo.createVersionSnapshot(sectionId);

    const pinned = await prisma.versionSnapshot.findFirst({
      where: { reportSectionId: sectionId, version: 1 },
    });
    expect(pinned).not.toBeNull();
    expect(pinned?.kind).toBe("pinned");
  });

  it("pinned snapshot in the 24h–7d hourly window survives thinning", async () => {
    const hourStart = new Date(Date.now() - (3 * 24 + 2) * 3_600_000);
    hourStart.setUTCMinutes(0, 0, 0);
    const sameHour = (m: number) => new Date(hourStart.getTime() + m * 60_000);

    // Pinned at HH:10 — would normally be pruned in favour of HH:50.
    await insertPinnedAt(1, sameHour(10));
    // Autosave at HH:50 — newest of the hour, keeps its slot.
    await insertAt(2, sameHour(50));

    await repo.createVersionSnapshot(sectionId);

    const snapshots = await prisma.versionSnapshot.findMany({
      where: { reportSectionId: sectionId },
      select: { version: true, kind: true },
    });
    const versions = snapshots.map((s) => s.version);
    // Both v1 (pinned) and v2 (newest-per-hour) must survive, plus the new one.
    expect(versions).toContain(1);
    expect(versions).toContain(2);
  });
});
