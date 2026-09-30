import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "../../../report-sections";
import { deriveHistoryStats } from "./lead-history-stats";

const entry = (status: HistoryEntry["status"]): HistoryEntry => ({
  id: status,
  periodId: status,
  weekLabel: "Week 20",
  dateRange: "May 11–17, 2026",
  status,
  submissionState: "unavailable",
  submittedAt: null,
  createdAt: null,
  lastEditAt: null,
  trafficLights: { green: 1, yellow: 0, red: 0 },
  itemCount: 4,
  riskCount: 1,
  decisionCount: 0,
  priorityCount: 0,
});

describe("deriveHistoryStats", () => {
  it("keeps a reopened period out of the published aggregates and the streak", () => {
    const stats = deriveHistoryStats([
      entry("reopened"),
      entry("published"),
      entry("published"),
    ]);

    expect(stats.submitted).toBe(2);
    expect(stats.streak).toBe(0);
    expect(stats.totalGreen).toBe(2);
    expect(stats.avgItems).toBe(4);
  });
});
