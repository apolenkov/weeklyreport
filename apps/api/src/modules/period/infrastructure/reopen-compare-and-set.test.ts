import { describe, expect, it, vi } from "vitest";

import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";
import { buildTransition } from "../domain/period-transition.js";
import { reopenCompareAndSet } from "./reopen-compare-and-set.js";

const expected: PeriodLifecycleExpectation = {
  periodStart: new Date("2026-08-24T00:00:00.000Z"),
  periodEnd: new Date("2026-08-30T00:00:00.000Z"),
  status: "published",
  periodState: "published",
  periodStatus: "published",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: new Date("2026-08-31T12:00:00.000Z"),
  publishedById: "user-1",
  reopenedAt: null,
};

const data = buildTransition("reopen", {
  now: new Date("2026-09-01T12:00:00.000Z"),
});

function client(count: number, current: object | null = null) {
  return {
    report: {
      updateMany: vi.fn().mockResolvedValue({ count }),
      findUnique: vi.fn().mockResolvedValue(current),
    },
  };
}

describe("reopenCompareAndSet", () => {
  it("matches every lifecycle and boundary field and passes data verbatim", async () => {
    const db = client(1);

    await expect(
      reopenCompareAndSet(db, "report-1", expected, data),
    ).resolves.toBe("transitioned");

    expect(db.report.updateMany).toHaveBeenCalledWith({
      where: {
        id: "report-1",
        ...expected,
      },
      data,
    });
  });

  it("classifies an archived expected row as archived", async () => {
    const db = client(1);

    await expect(
      reopenCompareAndSet(
        db,
        "report-1",
        { ...expected, archived: true },
        data,
      ),
    ).resolves.toBe("archived");
    expect(db.report.updateMany).not.toHaveBeenCalled();
  });

  it("classifies a non-published expected row as not reopenable", async () => {
    const db = client(1);

    await expect(
      reopenCompareAndSet(
        db,
        "report-1",
        { ...expected, periodStatus: "reopened" },
        data,
      ),
    ).resolves.toBe("notReopenable");
    expect(db.report.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, "stale"],
    ["archived", { archived: true, periodStatus: "published" }, "archived"],
    [
      "no longer published",
      { archived: false, periodStatus: "reopened" },
      "notReopenable",
    ],
    ["stale", { archived: false, periodStatus: "published" }, "stale"],
  ] as const)(
    "classifies a zero-row %s result",
    async (_name, current, outcome) => {
      const db = client(0, current);

      await expect(
        reopenCompareAndSet(db, "report-1", expected, data),
      ).resolves.toBe(outcome);
      expect(db.report.findUnique).toHaveBeenCalledWith({
        where: { id: "report-1" },
        select: { archived: true, periodStatus: true },
      });
    },
  );
});
