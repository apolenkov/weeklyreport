import { describe, expect, it, vi } from "vitest";

import type { PeriodLifecycleExpectation } from "../modules/period/domain/period-lifecycle-expectation.js";
import { buildTransition } from "../modules/period/domain/period-transition.js";
import { publishCompareAndSet } from "./publish-compare-and-set.js";

const expected: PeriodLifecycleExpectation = {
  periodStart: new Date("2026-08-24T00:00:00.000Z"),
  periodEnd: new Date("2026-08-30T00:00:00.000Z"),
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

const data = {
  ...buildTransition("publish", {
    now: new Date("2026-08-31T12:00:00.000Z"),
    userId: "user-1",
  }),
  publishedSnapshot: { version: 1 },
};

function client(count: number, current: object | null = null) {
  return {
    report: {
      updateMany: vi.fn().mockResolvedValue({ count }),
      findUnique: vi.fn().mockResolvedValue(current),
    },
  };
}

describe("publishCompareAndSet", () => {
  it("matches every lifecycle and boundary field and passes data verbatim", async () => {
    const db = client(1);

    await expect(
      publishCompareAndSet(db, "report-1", expected, data),
    ).resolves.toBe("transitioned");

    expect(db.report.updateMany).toHaveBeenCalledWith({
      where: {
        id: "report-1",
        ...expected,
      },
      data,
    });
  });

  it("classifies an archived and published expected row as archived", async () => {
    const db = client(1);

    await expect(
      publishCompareAndSet(
        db,
        "report-1",
        {
          ...expected,
          status: "published",
          periodState: "archived",
          periodStatus: "published",
          archived: true,
          publishedAt: new Date("2026-08-31T12:00:00.000Z"),
          publishedById: "user-1",
        },
        data,
      ),
    ).resolves.toBe("archived");
    expect(db.report.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, "stale"],
    ["stale", { archived: false, periodStatus: "open" }, "stale"],
    [
      "concurrent publish",
      { archived: false, periodStatus: "published" },
      "raced",
    ],
  ] as const)(
    "classifies a zero-row %s result",
    async (_name, current, outcome) => {
      const db = client(0, current);

      await expect(
        publishCompareAndSet(db, "report-1", expected, data),
      ).resolves.toBe(outcome);
      expect(db.report.findUnique).toHaveBeenCalledWith({
        where: { id: "report-1" },
        select: { archived: true, periodStatus: true },
      });
    },
  );
});
