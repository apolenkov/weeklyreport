// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import type { RecordOmissionSummary } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { PeriodComparisonTable } from "./period-comparison.table";
import { TrafficLightHistoryTable } from "./traffic-light-history.table";

const NOTHING: RecordOmissionSummary = {
  risks: 0,
  decisions: 0,
  unknown: false,
};
const PROJECT_ID = "10000000-0000-4000-8000-000000000001";

const period = (
  periodStart: string,
  periodEnd: string,
  omissions: RecordOmissionSummary = NOTHING,
) => ({ periodStart, periodEnd, omissions });

const earlier = (omissions?: RecordOmissionSummary) =>
  period("2026-08-17", "2026-08-23", omissions);
const later = (omissions?: RecordOmissionSummary) =>
  period("2026-08-24", "2026-08-30", omissions);

const historyRows = [
  {
    projectId: PROJECT_ID,
    projectName: "Portal",
    statuses: ["green", "yellow"] as const,
  },
];
const comparisonRows = [
  {
    projectId: PROJECT_ID,
    projectName: "Portal",
    statusA: "green" as const,
    statusB: "yellow" as const,
    riskCountA: 0,
    riskCountB: 1,
    riskDelta: 1,
  },
];

const note = () =>
  screen.getByRole("note", { name: "Records these figures leave out" });

describe("analytics omission notes", () => {
  it("stays silent when no period leaves anything out", () => {
    render(
      <TrafficLightHistoryTable
        headingId="h"
        periods={[earlier(), later()]}
        rows={historyRows}
      />,
    );

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("names only the periods that leave something out", () => {
    render(
      <TrafficLightHistoryTable
        headingId="h"
        periods={[
          earlier({ risks: 0, decisions: 0, unknown: true }),
          later({ risks: 2, decisions: 1, unknown: false }),
        ]}
        rows={historyRows}
      />,
    );

    const lines = within(note())
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /30.*2026: 2 unfinished risks and 1 unfinished decision$/,
    );
  });

  it("keeps the disclosure beside an empty history", () => {
    render(
      <TrafficLightHistoryTable
        headingId="h"
        periods={[later({ risks: 1, decisions: 0, unknown: true })]}
        rows={[]}
      />,
    );

    expect(screen.getByText(/no published periods/i)).toBeInTheDocument();
    expect(note()).toHaveTextContent("1 unfinished risk");
  });

  it("discloses both compared periods and skips a missing one", () => {
    const { rerender } = render(
      <PeriodComparisonTable
        headingId="c"
        periodA={earlier({ risks: 0, decisions: 3, unknown: false })}
        periodB={later({ risks: 1, decisions: 0, unknown: false })}
        rows={comparisonRows}
      />,
    );

    expect(within(note()).getAllByRole("listitem")).toHaveLength(2);
    expect(note()).toHaveTextContent("3 unfinished decisions");

    rerender(
      <PeriodComparisonTable
        headingId="c"
        periodA={null}
        periodB={later({ risks: 1, decisions: 0, unknown: false })}
        rows={[]}
      />,
    );

    expect(screen.getByText("No comparison data.")).toBeInTheDocument();
    expect(within(note()).getAllByRole("listitem")).toHaveLength(1);
  });
});
