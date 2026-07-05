import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildLeadVelocityChartData,
  LeadVelocityChart,
} from "./lead-velocity.chart";
import { PeriodComparisonChart } from "./period-comparison.chart";
import {
  buildTrafficLightHistoryChartData,
  TrafficLightHistoryChart,
} from "./traffic-light-history.chart";

describe("TrafficLightHistoryChart", () => {
  it("renders the empty-state message when no periods", () => {
    render(<TrafficLightHistoryChart periods={[]} rows={[]} />);
    expect(screen.getByText(/no published periods/i)).toBeInTheDocument();
  });

  it("renders without crash with sample data containing nulls", () => {
    render(
      <TrafficLightHistoryChart
        periods={["2026-04-21", "2026-04-28"]}
        rows={[
          {
            projectId: "11111111-1111-4111-8111-111111111111",
            projectName: "Alpha",
            statuses: ["green", null],
          },
        ]}
      />,
    );
    // ResponsiveContainer renders a wrapper div; assert basic mount.
    expect(document.body.querySelector("div")).toBeTruthy();
  });
});

describe("LeadVelocityChart", () => {
  it("renders the empty-state message when no rows", () => {
    render(<LeadVelocityChart rows={[]} />);
    expect(screen.getByText(/no velocity data/i)).toBeInTheDocument();
  });

  it("renders sample lead-velocity data without crash", () => {
    render(
      <LeadVelocityChart
        rows={[
          {
            periodLabel: "2026-04-21",
            leads: [
              {
                leadId: "00000000-0000-4000-8000-000000000001",
                leadName: "L1",
                submittedSections: 1,
              },
            ],
          },
        ]}
      />,
    );
    expect(document.body.querySelector("div")).toBeTruthy();
  });
});

describe("buildLeadVelocityChartData", () => {
  it("keeps both leads' values when they share a display name", () => {
    const idA = "00000000-0000-4000-8000-00000000000a";
    const idB = "00000000-0000-4000-8000-00000000000b";

    const { data, series } = buildLeadVelocityChartData([
      {
        periodLabel: "2026-04-21",
        leads: [
          { leadId: idA, leadName: "Alex", submittedSections: 3 },
          { leadId: idB, leadName: "Alex", submittedSections: 5 },
        ],
      },
    ]);

    expect(data).toHaveLength(1);
    const point = data[0];
    expect(point.period).toBe("2026-04-21");
    // Keyed by UUID, the colliding name does not overwrite the first value.
    expect(point[idA]).toBe(3);
    expect(point[idB]).toBe(5);
    expect(series).toEqual([
      { dataKey: idA, name: "Alex" },
      { dataKey: idB, name: "Alex" },
    ]);
  });
});

describe("buildTrafficLightHistoryChartData", () => {
  it("keeps both projects' statuses when they share a display name", () => {
    const idA = "11111111-1111-4111-8111-11111111111a";
    const idB = "11111111-1111-4111-8111-11111111111b";

    const { data, series } = buildTrafficLightHistoryChartData(
      ["2026-04-21"],
      [
        { projectId: idA, projectName: "Alpha", statuses: ["green"] },
        { projectId: idB, projectName: "Alpha", statuses: ["red"] },
      ],
    );

    expect(data).toHaveLength(1);
    const point = data[0];
    expect(point.period).toBe("2026-04-21");
    // Keyed by UUID, the colliding name keeps each project's status distinct.
    expect(point[idA]).toBe(3);
    expect(point[idB]).toBe(1);
    expect(series).toEqual([
      { dataKey: idA, name: "Alpha" },
      { dataKey: idB, name: "Alpha" },
    ]);
  });
});

describe("PeriodComparisonChart", () => {
  it("renders the empty-state message when no rows", () => {
    render(<PeriodComparisonChart rows={[]} />);
    expect(screen.getByText(/no comparison data/i)).toBeInTheDocument();
  });

  it("renders null cells as em-dash and zero cells as 0 (CONTEXT D-3)", () => {
    render(
      <PeriodComparisonChart
        rows={[
          {
            projectId: "11111111-1111-4111-8111-111111111111",
            projectName: "Alpha",
            statusA: null,
            statusB: "green",
            riskCountA: 0,
            riskCountB: 0,
            riskDelta: 0,
          },
        ]}
      />,
    );
    // null status renders as em-dash
    expect(screen.getByText("–")).toBeInTheDocument();
    // zero risk count renders as the literal '0'
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it("renders positive delta with + prefix and red colour class", () => {
    const { container } = render(
      <PeriodComparisonChart
        rows={[
          {
            projectId: "11111111-1111-4111-8111-111111111111",
            projectName: "Alpha",
            statusA: "green",
            statusB: "red",
            riskCountA: 1,
            riskCountB: 4,
            riskDelta: 3,
          },
        ]}
      />,
    );
    expect(screen.getByText("+3")).toBeInTheDocument();
    const deltaCell = container.querySelector(".text-red-600");
    expect(deltaCell).not.toBeNull();
  });
});
