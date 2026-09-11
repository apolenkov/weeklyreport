import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { deriveViewerPeriods } from "./derive-viewer-periods";

function historyEntry(
  reportId: string,
  periodStart: string,
): CompiledHistoryEntry {
  return {
    reportId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodStart),
    archived: true,
  } as unknown as CompiledHistoryEntry;
}

function displayedReport(
  reportId: string,
  periodStart: string,
): WeeklyReportGetResponse {
  return {
    status: "active",
    reportId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodStart),
  } as unknown as WeeklyReportGetResponse;
}

describe("deriveViewerPeriods", () => {
  it("keeps the combined list newest-first when the addressed period is older than history", () => {
    const periods = deriveViewerPeriods(
      [historyEntry("wk36", "2026-08-31"), historyEntry("wk35", "2026-08-24")],
      displayedReport("wk34", "2026-08-17"),
      "wk34",
    );

    expect(periods.map((period) => period.id)).toEqual([
      "wk36",
      "wk35",
      "wk34",
    ]);
  });

  it("inserts the displayed period without duplicating a matching history entry", () => {
    const periods = deriveViewerPeriods(
      [historyEntry("wk36", "2026-08-31")],
      displayedReport("wk36", "2026-08-31"),
      "wk36",
    );

    expect(periods.map((period) => period.id)).toEqual(["wk36"]);
  });

  it("returns the newest-first history when no period is displayed", () => {
    const periods = deriveViewerPeriods(
      [historyEntry("wk35", "2026-08-24"), historyEntry("wk36", "2026-08-31")],
      undefined,
      "wk34",
    );

    expect(periods.map((period) => period.id)).toEqual(["wk36", "wk35"]);
  });
});
