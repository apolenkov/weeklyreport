import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";
import { deriveHeadPeriods } from "./head-report-periods";

type ActiveWeeklyReport = Extract<
  WeeklyReportGetResponse,
  { status: "active" }
>;

// Active leads, displayed follows; skip when the id is already reachable.
function historyEntry(
  reportId: string,
  archived = false,
): CompiledHistoryEntry {
  return {
    reportId,
    periodStart: new Date("2026-05-18T00:00:00.000Z"),
    periodEnd: new Date("2026-05-24T00:00:00.000Z"),
    publishedAt: new Date("2026-05-25T09:00:00.000Z"),
    archived,
    reopened: false,
    publishedByName: "Head User",
    trafficLights: { green: 1, yellow: 0, red: 0 },
    itemCount: 1,
    riskCount: 0,
    decisionCount: 0,
    priorityCount: 0,
    sectionCount: 1,
    productCount: 1,
  };
}

function activeReport(
  reportId: string,
  lifecycle: Pick<
    ActiveWeeklyReport,
    "periodState" | "periodStatus" | "archived"
  > = { periodState: "open", periodStatus: "open", archived: false },
): WeeklyReportGetResponse {
  return {
    status: "active",
    ...makeWeeklyReportFixture({
      reportId,
      periodStart: new Date("2026-06-08T00:00:00.000Z"),
      periodEnd: new Date("2026-06-14T00:00:00.000Z"),
      ...lifecycle,
    }),
  };
}

describe("deriveHeadPeriods", () => {
  it("prepends both active and displayed when neither is in history", () => {
    const periods = deriveHeadPeriods(
      [historyEntry("hist-1")],
      activeReport("active-id"),
      activeReport("displayed-id", {
        periodState: "published",
        periodStatus: "published",
        archived: false,
      }),
      "displayed-id",
    );

    expect(periods.map((p) => p.id)).toEqual([
      "active-id",
      "displayed-id",
      "hist-1",
    ]);
    // Active is a non-published (current) week; displayed is published.
    expect(periods[0]?.isCurrent).toBe(true);
    expect(periods[1]?.isCurrent).toBe(false);
  });

  it("prepends neither when both ids already appear in history", () => {
    const periods = deriveHeadPeriods(
      [historyEntry("active-id"), historyEntry("displayed-id")],
      activeReport("active-id"),
      activeReport("displayed-id", {
        periodState: "published",
        periodStatus: "published",
        archived: false,
      }),
      "displayed-id",
    );

    expect(periods.map((p) => p.id)).toEqual(["active-id", "displayed-id"]);
    expect(periods.map((p) => p.isCurrent)).toEqual([true, false]);
    expect(periods.map((p) => p.periodState)).toEqual(["open", "published"]);
  });

  it("skips displayed when its route id equals the active reportId", () => {
    const periods = deriveHeadPeriods(
      [historyEntry("hist-1")],
      activeReport("same-id"),
      activeReport("same-id"),
      "same-id",
    );

    expect(periods.map((p) => p.id)).toEqual(["same-id", "hist-1"]);
  });

  it("keeps actual active identity when a scheduled report is displayed", () => {
    const periods = deriveHeadPeriods(
      [],
      activeReport("open-001"),
      activeReport("scheduled-007", {
        periodState: "scheduled",
        periodStatus: "open",
        archived: false,
      }),
      "scheduled-007",
    );

    expect(periods).toMatchObject([
      { id: "open-001", isCurrent: true, periodState: "open" },
      {
        id: "scheduled-007",
        isCurrent: false,
        periodState: "scheduled",
      },
    ]);
  });

  it("preserves reopened, published and archived lifecycle projections", () => {
    const periods = deriveHeadPeriods(
      [historyEntry("archived-id", true)],
      activeReport("reopened-id", {
        periodState: "open",
        periodStatus: "reopened",
        archived: false,
      }),
      activeReport("published-id", {
        periodState: "published",
        periodStatus: "published",
        archived: false,
      }),
      "published-id",
    );

    expect(periods).toMatchObject([
      { id: "reopened-id", isCurrent: true, periodState: "open" },
      { id: "published-id", isCurrent: false, periodState: "published" },
      {
        id: "archived-id",
        isCurrent: false,
        periodState: "archived",
        archived: true,
      },
    ]);
  });

  it("projects live envelope dates for a reopened candidate kept in history", () => {
    // The frozen entry keeps its old envelope; the reopened live report was
    // re-dated to a newer week, so navigation must sort and label by the live
    // dates, not the compiled snapshot.
    const reopenedEntry: CompiledHistoryEntry = {
      ...historyEntry("reopened-id"),
      reopened: true,
      periodStart: new Date("2026-05-18T00:00:00.000Z"),
      periodEnd: new Date("2026-05-24T00:00:00.000Z"),
    };
    const newerHistory: CompiledHistoryEntry = {
      ...historyEntry("hist-newer"),
      periodStart: new Date("2026-06-22T00:00:00.000Z"),
      periodEnd: new Date("2026-06-28T00:00:00.000Z"),
    };
    // The live envelope was re-dated forward so it sorts ahead of the newer
    // history week even though the frozen entry predates it.
    const liveReopened: WeeklyReportGetResponse = {
      status: "active",
      ...makeWeeklyReportFixture({
        reportId: "reopened-id",
        periodStart: new Date("2026-07-06T00:00:00.000Z"),
        periodEnd: new Date("2026-07-12T00:00:00.000Z"),
        periodState: "open",
        periodStatus: "reopened",
        archived: false,
      }),
    };

    const periods = deriveHeadPeriods(
      [reopenedEntry, newerHistory],
      liveReopened,
      undefined,
      "unrelated-id",
    );

    expect(periods.map((p) => p.id)).toEqual(["reopened-id", "hist-newer"]);
    expect(periods[0]).toMatchObject({
      id: "reopened-id",
      isCurrent: true,
      periodState: "open",
      periodStart: new Date("2026-07-06T00:00:00.000Z"),
    });
  });

  it("marks a reopened history entry without a live candidate as open, not published", () => {
    const reopenedEntry: CompiledHistoryEntry = {
      ...historyEntry("reopened-id"),
      reopened: true,
    };

    const periods = deriveHeadPeriods(
      [reopenedEntry],
      activeReport("active-id"),
      undefined,
      "unrelated-id",
    );

    const reopened = periods.find((period) => period.id === "reopened-id");
    expect(reopened).toMatchObject({
      periodState: "open",
      isCurrent: false,
      archived: false,
    });
  });

  it("keeps the frozen envelope when the displayed payload is another report", () => {
    // The displayed candidate is keyed by the URL id, but weeklyReport.get may
    // resolve a different report (e.g. the active week for a superseded id).
    // That foreign envelope must not re-date the matching history entry.
    const olderEntry: CompiledHistoryEntry = {
      ...historyEntry("older-id"),
      periodStart: new Date("2026-05-18T00:00:00.000Z"),
      periodEnd: new Date("2026-05-24T00:00:00.000Z"),
    };

    const periods = deriveHeadPeriods(
      [olderEntry],
      activeReport("active-id"),
      activeReport("active-id"),
      "older-id",
    );

    const older = periods.find((period) => period.id === "older-id");
    expect(older).toMatchObject({
      periodStart: new Date("2026-05-18T00:00:00.000Z"),
      isCurrent: false,
    });
    expect(older?.dateRange).toMatch(/May 18/);
  });

  it("orders a displayed older period newest-first against history", () => {
    const newerHistory: CompiledHistoryEntry = {
      ...historyEntry("hist-newer"),
      periodStart: new Date("2026-06-22T00:00:00.000Z"),
      periodEnd: new Date("2026-06-28T00:00:00.000Z"),
    };

    const periods = deriveHeadPeriods(
      [newerHistory],
      undefined,
      activeReport("displayed-older", {
        periodState: "published",
        periodStatus: "published",
        archived: false,
      }),
      "displayed-older",
    );

    expect(periods.map((p) => p.id)).toEqual(["hist-newer", "displayed-older"]);
  });
});
