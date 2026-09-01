import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  buildLeadVelocityChartData,
  buildTrafficLightHistoryChartData,
  formatTrafficLightStatusLevel,
} from "./analytics-chart-data";
import { LeadVelocityChart } from "./lead-velocity.chart";
import { PeriodComparisonChart } from "./period-comparison.chart";
import { TrafficLightHistoryChart } from "./traffic-light-history.chart";

function installChartBounds(): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 800, 256),
  );
}

describe("TrafficLightHistoryChart", () => {
  it("renders the empty-state message when no periods", () => {
    render(<TrafficLightHistoryChart periods={[]} rows={[]} />);
    expect(screen.getByText(/no published periods/i)).toBeInTheDocument();
  });

  it("renders populated data through an accessible table", () => {
    installChartBounds();
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    render(
      <TrafficLightHistoryChart
        periods={["Apr 7", "Apr 14"]}
        rows={[
          {
            projectId: "11111111-1111-4111-8111-111111111111",
            projectName: "Alpha",
            statuses: ["green", null],
          },
        ]}
      />,
    );
    expect(screen.queryByText(/no published periods/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Traffic-light history data" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Alpha" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Green" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "No data" })).toBeVisible();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("keeps a null status cell null in the series point", () => {
    const { data } = buildTrafficLightHistoryChartData(
      ["Apr 7", "Apr 14"],
      [
        {
          projectId: "11111111-1111-4111-8111-111111111111",
          projectName: "Alpha",
          statuses: ["green", null],
        },
      ],
    );
    expect(data[1]?.["11111111-1111-4111-8111-111111111111"]).toBeNull();
  });

  it("labels numeric status levels with their traffic-light meaning", () => {
    expect([1, 2, 3].map(formatTrafficLightStatusLevel)).toEqual([
      "Red",
      "Yellow",
      "Green",
    ]);
  });
});

describe("LeadVelocityChart", () => {
  it("renders the empty-state message when no rows", () => {
    render(<LeadVelocityChart rows={[]} />);
    expect(screen.getByText(/no velocity data/i)).toBeInTheDocument();
  });

  it("renders populated data through an accessible table", () => {
    installChartBounds();
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    render(
      <LeadVelocityChart
        rows={[
          {
            periodLabel: "Apr 7",
            leads: [
              {
                leadId: "22222222-2222-4222-8222-222222222222",
                leadName: "Alex",
                submittedSections: 3,
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByText(/no velocity data/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Lead velocity data in submitted sections",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Alex" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "3" })).toBeVisible();
    expect(consoleWarn).not.toHaveBeenCalled();
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
    const point = expectDefined(data[0]);
    expect(point.period).toBe("2026-04-21");
    // Keyed by UUID, the colliding name does not overwrite the first value.
    expect(point[idA]).toBe(3);
    expect(point[idB]).toBe(5);
    expect(series).toEqual([
      { dataKey: idA, name: "Alex" },
      { dataKey: idB, name: "Alex" },
    ]);
  });

  it("fills absent leads with zero across multiple periods", () => {
    const { data } = buildLeadVelocityChartData([
      {
        periodLabel: "2026-07-20",
        leads: [{ leadId: "lead-a", leadName: "Lead A", submittedSections: 2 }],
      },
      {
        periodLabel: "2026-07-27",
        leads: [{ leadId: "lead-b", leadName: "Lead B", submittedSections: 3 }],
      },
    ]);

    expect(data).toEqual([
      { period: "2026-07-20", "lead-a": 2, "lead-b": 0 },
      { period: "2026-07-27", "lead-a": 0, "lead-b": 3 },
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
    const point = expectDefined(data[0]);
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

  it("renders null cells as en-dash and zero cells as 0", () => {
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
    // null status renders as en-dash
    expect(screen.getByText("–")).toBeInTheDocument();
    // zero risk count renders as the literal '0'
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it("renders positive delta with + prefix and red colour class", () => {
    render(
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
    // Scoped to the delta cell itself, not container-wide, so this cannot
    // pass on the unrelated statusB="red" status cell if deltaClass's
    // red-mapping breaks. The semantic destructive token stands in for the
    // raw red utility so theme swaps cannot silently break the assertion.
    const deltaCell = screen.getByText("+3");
    expect(deltaCell.className).toContain("text-[var(--color-destructive)]");
  });
});
