import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { deriveHeadPeriods } from "./head-report-periods";

// Active leads, displayed follows; skip when the id is already reachable.
function historyEntry(reportId: string): CompiledHistoryEntry {
  return {
    reportId,
    periodStart: "2026-05-18T00:00:00.000Z",
    periodEnd: "2026-05-24T00:00:00.000Z",
    archived: false,
  } as unknown as CompiledHistoryEntry;
}

function activeReport(
  reportId: string,
  periodStatus: "open" | "published" = "open",
): WeeklyReportGetResponse {
  return {
    status: "active",
    reportId,
    periodStart: "2026-06-08T00:00:00.000Z",
    periodEnd: "2026-06-14T00:00:00.000Z",
    periodStatus,
  } as unknown as WeeklyReportGetResponse;
}

describe("deriveHeadPeriods", () => {
  it("prepends both active and displayed when neither is in history", () => {
    const periods = deriveHeadPeriods(
      [historyEntry("hist-1")],
      activeReport("active-id"),
      activeReport("displayed-id", "published"),
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
      activeReport("displayed-id", "published"),
      "displayed-id",
    );

    expect(periods.map((p) => p.id)).toEqual(["active-id", "displayed-id"]);
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
});
