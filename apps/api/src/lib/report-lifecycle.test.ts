import { describe, expect, it, vi } from "vitest";

import { lockCurrentEditableReport } from "./report-lifecycle.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PUBLISHER_ID = "22222222-2222-4222-8222-222222222222";
const openReport = {
  id: REPORT_ID,
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
} as const;

const txWith = (row: object | null) => ({
  $queryRaw: vi.fn().mockResolvedValue(row ? [row] : []),
});

describe("lockCurrentEditableReport", () => {
  it("admits the exact open-draft tuple after locking by report id", async () => {
    const tx = txWith(openReport);

    await expect(
      lockCurrentEditableReport(tx as never, { reportId: REPORT_ID }),
    ).resolves.toEqual({ kind: "editable", reportId: REPORT_ID });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("admits the exact reopened-published tuple after locking by section id", async () => {
    const tx = txWith({
      ...openReport,
      status: "published",
      periodStatus: "reopened",
      publishedAt: new Date("2026-08-31T08:00:00.000Z"),
      publishedById: PUBLISHER_ID,
      reopenedAt: new Date("2026-08-31T09:00:00.000Z"),
    });

    await expect(
      lockCurrentEditableReport(tx as never, { sectionId: "section-1" }),
    ).resolves.toEqual({ kind: "editable", reportId: REPORT_ID });
  });

  it.each([
    ["scheduled", { ...openReport, periodState: "scheduled" }],
    [
      "published",
      {
        ...openReport,
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-08-31T08:00:00.000Z"),
        publishedById: PUBLISHER_ID,
      },
    ],
    ["archived", { ...openReport, periodState: "archived", archived: true }],
  ] as const)(
    "rejects a valid but non-editable %s tuple",
    async (_label, row) => {
      await expect(
        lockCurrentEditableReport(txWith(row) as never, {
          reportId: REPORT_ID,
        }),
      ).resolves.toEqual({ kind: "not-editable" });
    },
  );

  it("distinguishes a contradictory lifecycle tuple", async () => {
    await expect(
      lockCurrentEditableReport(
        txWith({ ...openReport, status: "published" }) as never,
        { reportId: REPORT_ID },
      ),
    ).resolves.toEqual({ kind: "inconsistent" });
  });

  it("distinguishes a missing report or section", async () => {
    await expect(
      lockCurrentEditableReport(txWith(null) as never, {
        sectionId: "missing-section",
      }),
    ).resolves.toEqual({ kind: "not-found" });
  });
});
