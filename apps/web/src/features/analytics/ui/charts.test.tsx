import type { TrafficLightHistoryOutput } from "@customreport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { buildLeadVelocityChartData } from "./analytics-chart-data";
import { LeadVelocityChart } from "./lead-velocity.chart";
import { PeriodComparisonChart } from "./period-comparison.chart";
import { TrafficLightHistoryChart } from "./traffic-light-history.chart";

const periods = ["2026-08-23", "2026-08-30"];

describe("TrafficLightHistoryChart", () => {
  it("renders the empty-state message when no periods", () => {
    render(
      <TrafficLightHistoryChart
        headingId="history-heading"
        periods={[]}
        rows={[]}
      />,
    );
    expect(screen.getByText(/no published periods/i)).toBeInTheDocument();
  });

  it("shows project rows with full dates, product status labels and a named keyboard region", async () => {
    render(
      <>
        <h2 id="history-heading">Traffic-light history</h2>
        <TrafficLightHistoryChart
          headingId="history-heading"
          periods={periods}
          rows={[
            {
              projectId: "alpha",
              projectName: "Alpha",
              statuses: ["green", null],
            },
            {
              projectId: "beta",
              projectName: "Beta",
              statuses: ["yellow", "red"],
            },
            { projectId: "gamma", projectName: "Gamma", statuses: ["green"] },
          ]}
        />
      </>,
    );
    const table = screen.getByRole("table", {
      name: "Traffic-light history data",
    });
    expect(table).toBeVisible();
    expect(table.closest(".sr-only")).toBeNull();
    for (const period of periods)
      expect(
        within(table).getByRole("columnheader", { name: period }),
      ).toHaveAttribute("scope", "col");
    expect(
      within(table).getByRole("rowheader", { name: "Alpha" }),
    ).toHaveAttribute("scope", "row");
    const alpha = within(table)
      .getByRole("rowheader", { name: "Alpha" })
      .closest("tr");
    expect(
      within(expectDefined(alpha)).getByRole("cell", { name: "On track" }),
    ).toBeVisible();
    expect(
      within(expectDefined(alpha)).getByRole("cell", { name: "No status" }),
    ).toBeVisible();
    expect(
      within(table).getAllByRole("cell", { name: "No status" }),
    ).toHaveLength(2);
    expect(within(table).getByRole("cell", { name: "At risk" })).toBeVisible();
    expect(within(table).getByRole("cell", { name: "Blocked" })).toBeVisible();
    const region = screen.getByRole("region", {
      name: "Traffic-light history",
    });
    expect(region).toHaveAttribute("aria-labelledby", "history-heading");
    await userEvent.tab();
    expect(region).toHaveFocus();
  });

  it("stably puts worst Red and Yellow projects first without changing input rows", () => {
    const rows: TrafficLightHistoryOutput["rows"] = [
      {
        projectId: "green-a",
        projectName: "Green A",
        statuses: ["green", "green"],
      },
      {
        projectId: "yellow-a",
        projectName: "Yellow A",
        statuses: ["green", "yellow"],
      },
      { projectId: "empty", projectName: "Empty", statuses: [null, null] },
      { projectId: "red-a", projectName: "Red A", statuses: ["yellow", "red"] },
      {
        projectId: "yellow-b",
        projectName: "Yellow B",
        statuses: ["yellow", "green"],
      },
      { projectId: "red-b", projectName: "Red B", statuses: ["red", null] },
      {
        projectId: "green-b",
        projectName: "Green B",
        statuses: ["green", "green"],
      },
    ];
    const original = structuredClone(rows);
    render(
      <>
        <h2 id="history-heading">Traffic-light history</h2>
        <TrafficLightHistoryChart
          headingId="history-heading"
          periods={periods}
          rows={rows}
        />
      </>,
    );
    expect(
      screen.getAllByRole("rowheader").map((header) => header.textContent),
    ).toEqual([
      "Red A",
      "Red B",
      "Yellow A",
      "Yellow B",
      "Green A",
      "Empty",
      "Green B",
    ]);
    expect(rows).toEqual(original);
  });
});

describe("LeadVelocityChart", () => {
  it("renders the empty-state message when no rows", () => {
    render(<LeadVelocityChart headingId="velocity-heading" rows={[]} />);
    expect(screen.getByText(/no velocity data/i)).toBeInTheDocument();
  });

  it("shows lead rows and submitted counts including absent-lead zero in a named keyboard region", async () => {
    render(
      <>
        <h2 id="velocity-heading">Lead velocity</h2>
        <LeadVelocityChart
          headingId="velocity-heading"
          rows={[
            {
              periodLabel: "2026-08-23",
              leads: [
                { leadId: "lead-a", leadName: "Alex", submittedSections: 3 },
              ],
            },
            {
              periodLabel: "2026-08-30",
              leads: [
                { leadId: "lead-b", leadName: "Alex", submittedSections: 5 },
              ],
            },
          ]}
        />
      </>,
    );
    const table = screen.getByRole("table", {
      name: "Lead velocity data in submitted sections",
    });
    expect(table).toBeVisible();
    expect(table.closest(".sr-only")).toBeNull();
    for (const period of periods)
      expect(
        within(table).getByRole("columnheader", { name: period }),
      ).toHaveAttribute("scope", "col");
    expect(
      within(table).getAllByRole("rowheader", { name: "Alex" }),
    ).toHaveLength(2);
    expect(within(table).getByRole("cell", { name: "3" })).toBeVisible();
    expect(within(table).getByRole("cell", { name: "5" })).toBeVisible();
    for (const cell of within(table).getAllByRole("cell", { name: "0" }))
      expect(cell).toHaveClass("text-muted-foreground");
    expect(table.querySelector(".font-mono")).toBeNull();
    const region = screen.getByRole("region", { name: "Lead velocity" });
    expect(region).toHaveAttribute("aria-labelledby", "velocity-heading");
    await userEvent.tab();
    expect(region).toHaveFocus();
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

describe("PeriodComparisonChart", () => {
  it("renders the empty-state message when no rows", () => {
    render(
      <PeriodComparisonChart
        rows={[]}
        periodA="2026-08-23"
        periodB="2026-08-30"
      />,
    );
    expect(screen.getByText(/no comparison data/i)).toBeInTheDocument();
  });

  it("renders missing status as No status and zero risks as 0", () => {
    render(
      <PeriodComparisonChart
        periodA="2026-08-23"
        periodB="2026-08-30"
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
    expect(screen.getByRole("cell", { name: "No status" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "On track" })).toBeVisible();
    expect(screen.getByRole("table").querySelector(".font-mono")).toBeNull();
    // zero risk count renders as the literal '0'
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    { periodA: "2026-08-23", periodB: "2026-08-30" },
    { periodA: "2026-08-30", periodB: "2026-09-06" },
  ])(
    "identifies $periodA → $periodB and labels the positive risk change",
    ({ periodA, periodB }) => {
      render(
        <PeriodComparisonChart
          periodA={periodA}
          periodB={periodB}
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
      expect(screen.getByRole("table")).toHaveAccessibleName(
        `Periods ending ${periodA} (previous) and ${periodB} (latest). Risk change is latest minus previous.`,
      );
      expect(
        screen.getByRole("columnheader", { name: "Previous status" }),
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Latest status" }),
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Risk change" }),
      ).toBeVisible();
    },
  );
});
