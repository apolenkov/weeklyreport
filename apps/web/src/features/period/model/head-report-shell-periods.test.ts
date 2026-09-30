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
