import type { AppSettings } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { AutoArchiverScheduler } from "./auto-archiver.scheduler.js";

const settings = {
  autoArchiveWeeksAfterPublish: 4,
} as unknown as AppSettings;

const asAny = (value: unknown): never => value as never;

function schedulerWith(periodAutoArchive: () => void) {
  const report = {
    findMany: vi
      .fn()
      .mockResolvedValue([
        { id: "rep-old-1", publishedAt: new Date("2026-05-01T00:00:00Z") },
      ]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    report,
    reminderRule: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    report,
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const admin = { getSettings: vi.fn().mockResolvedValue(settings) };
  const audit = { ...createNullAuditLogger(), periodAutoArchive };
  return new AutoArchiverScheduler(asAny(prisma), asAny(admin), asAny(audit));
}

// TASK-503.52 / C1207. The audit is emitted after the archive transaction has
// committed, so its failure cannot undo the archive. The throwing audit sink is
// a fault injection, not an admitted production path; the policy follows the
// accepted TASK-503.32 contract (post-outcome, best-effort).
describe("AutoArchiverScheduler — audit failure after a committed archive", () => {
  const now = new Date("2026-06-15T00:15:00Z");

  it("control: a working audit sink reports the archived period", async () => {
    const result = await schedulerWith(() => undefined).runOnce(now);

    expect(result).toEqual({
      archived: true,
      periodIds: ["rep-old-1"],
      failures: [],
    });
  });

  it("still reports an archived period as archived when the audit sink throws", async () => {
    const result = await schedulerWith(() => {
      throw new Error("audit sink unavailable");
    }).runOnce(now);

    expect(result).toEqual({
      archived: true,
      periodIds: ["rep-old-1"],
      failures: [],
    });
  });
});
