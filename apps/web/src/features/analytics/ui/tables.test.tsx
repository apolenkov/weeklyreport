import type {
  TrafficLightHistoryOutput,
  TrafficLightStatus,
} from "@customreport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { buildLeadSubmissionsTableData } from "./analytics-table-data";
import { LeadSubmissionsTable } from "./lead-submissions.table";
import { PeriodComparisonTable } from "./period-comparison.table";
import { TrafficLightHistoryTable } from "./traffic-light-history.table";

const periods = [
  { periodStart: "2026-08-17", periodEnd: "2026-08-23" },
  { periodStart: "2026-08-24", periodEnd: "2026-08-30" },
] as const;

describe("TrafficLightHistoryTable", () => {
  it("renders the empty-state message when no periods", () => {
    render(
      <TrafficLightHistoryTable
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
        <TrafficLightHistoryTable
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
    for (const range of ["Aug 17\u201323, 2026", "Aug 24\u201330, 2026"])
      expect(
        within(table).getByRole("columnheader", { name: range }),
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
    expect(
      within(table).getByRole("cell", { name: "Blocked Slipped" }),
    ).toBeVisible();
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
        <TrafficLightHistoryTable
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

  it("shows the latest period first while keeping statuses and changes tied to their original periods", () => {
    const history: TrafficLightHistoryOutput = {
      periods: [
        { periodStart: "2026-08-17", periodEnd: "2026-08-23" },
        { periodStart: "2026-08-24", periodEnd: "2026-08-30" },
        { periodStart: "2026-08-31", periodEnd: "2026-09-06" },
      ],
      rows: [
        {
          projectId: "alpha",
          projectName: "Alpha",
          statuses: ["yellow", "red", "green"],
        },
      ],
    };
    const original = structuredClone(history);
    render(
      <TrafficLightHistoryTable {...history} headingId="history-heading" />,
    );

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Project",
      "Aug 31\u2013Sep 6, 2026",
      "Aug 24\u201330, 2026",
      "Aug 17\u201323, 2026",
    ]);
    expect(
      screen.getAllByRole("cell").map((cell) => cell.textContent.trim()),
    ).toEqual(["On track ↑ Recovered", "Blocked", "At risk"]);
    expect(screen.getByText(/Period/)).toHaveTextContent(
      "Period Aug 31\u2013Sep 6, 2026: 1 project on track",
    );
    expect(history).toEqual(original);
  });
});

describe("LeadSubmissionsTable", () => {
  it("renders the empty-state message when no rows", () => {
    render(<LeadSubmissionsTable headingId="velocity-heading" rows={[]} />);
    expect(screen.getByText(/no submissions data/i)).toBeInTheDocument();
  });

  it("shows distinct same-name lead rows with submissions and absent-lead Missing in a named keyboard region", async () => {
    render(
      <>
        <h2 id="velocity-heading">Lead submissions</h2>
        <LeadSubmissionsTable
          headingId="velocity-heading"
          rows={[
            {
              ...{ periodStart: "2026-08-17", periodEnd: "2026-08-23" },
              leads: [
                { leadId: "lead-a", leadName: "Alex", submittedSections: 3 },
              ],
            },
            {
              ...{ periodStart: "2026-08-24", periodEnd: "2026-08-30" },
              leads: [
                { leadId: "lead-b", leadName: "Alex", submittedSections: 5 },
              ],
            },
          ]}
        />
      </>,
    );
    const table = screen.getByRole("table", {
      name: "Lead submissions",
    });
    expect(table).toBeVisible();
    expect(table.closest(".sr-only")).toBeNull();
    for (const range of ["Aug 17–23, 2026", "Aug 24–30, 2026"])
      expect(
        within(table).getByRole("columnheader", { name: range }),
      ).toHaveAttribute("scope", "col");
    expect(
      within(table).getAllByRole("rowheader", { name: "Alex" }),
    ).toHaveLength(2);
    expect(
      within(table).getAllByRole("cell", { name: "Submitted" }),
    ).toHaveLength(2);
    expect(
      within(table).getAllByRole("cell", { name: "Missing" }),
    ).toHaveLength(2);
    for (const cell of within(table).getAllByRole("cell", { name: "Missing" }))
      expect(cell).toHaveClass("text-muted-foreground");
    expect(table.querySelector(".font-mono")).toBeNull();
    const region = screen.getByRole("region", { name: "Lead submissions" });
    expect(region).toHaveAttribute("aria-labelledby", "velocity-heading");
    await userEvent.tab();
    expect(region).toHaveFocus();
  });

  it("shows newest submissions first without changing lead membership or period values", () => {
    const rows = [
      {
        ...{ periodStart: "2026-08-17", periodEnd: "2026-08-23" },
        leads: [
          { leadId: "alex", leadName: "Alex", submittedSections: 1 },
          { leadId: "blair", leadName: "Blair", submittedSections: 0 },
        ],
      },
      {
        ...{ periodStart: "2026-08-24", periodEnd: "2026-08-30" },
        leads: [{ leadId: "alex", leadName: "Alex", submittedSections: 0 }],
      },
      {
        ...{ periodStart: "2026-08-31", periodEnd: "2026-09-06" },
        leads: [{ leadId: "blair", leadName: "Blair", submittedSections: 1 }],
      },
    ];
    const original = structuredClone(rows);
    render(
      <LeadSubmissionsTable rows={rows} headingId="submissions-heading" />,
    );

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Lead",
      "Aug 31–Sep 6, 2026",
      "Aug 24–30, 2026",
      "Aug 17–23, 2026",
    ]);
    const renderedRows = screen.getAllByRole("row").slice(1);
    expect(
      within(expectDefined(renderedRows[0]))
        .getAllByRole("cell")
        .map((cell) => cell.textContent.trim()),
    ).toEqual(["Missing", "Missing", "✓ Submitted"]);
    expect(
      within(expectDefined(renderedRows[1]))
        .getAllByRole("cell")
        .map((cell) => cell.textContent.trim()),
    ).toEqual(["✓ Submitted", "Missing", "Missing"]);
    expect(rows).toEqual(original);
  });

  it("retains the only submitted period without suggesting earlier columns", () => {
    render(
      <LeadSubmissionsTable
        headingId="submissions-heading"
        rows={[
          {
            ...{ periodStart: "2026-08-17", periodEnd: "2026-08-23" },
            leads: [{ leadId: "alex", leadName: "Alex", submittedSections: 1 }],
          },
        ]}
      />,
    );
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Lead", "Aug 17–23, 2026"]);
    expect(screen.getByRole("cell", { name: "Submitted" })).toBeVisible();
    expect(screen.queryByText(/Scroll horizontally/)).toBeNull();
  });
});

describe("buildLeadSubmissionsTableData", () => {
  it("keeps both leads' values when they share a display name", () => {
    const idA = "00000000-0000-4000-8000-00000000000a";
    const idB = "00000000-0000-4000-8000-00000000000b";

    const { data, series } = buildLeadSubmissionsTableData([
      {
        ...{ periodStart: "2026-04-15", periodEnd: "2026-04-21" },
        leads: [
          { leadId: idA, leadName: "Alex", submittedSections: 3 },
          { leadId: idB, leadName: "Alex", submittedSections: 5 },
        ],
      },
    ]);

    expect(data).toHaveLength(1);
    const point = expectDefined(data[0]);
    expect(point.periodEnd).toBe("2026-04-21");
    // Keyed by UUID, the colliding name does not overwrite the first value.
    expect(point[idA]).toBe(3);
    expect(point[idB]).toBe(5);
    expect(series).toEqual([
      { dataKey: idA, name: "Alex" },
      { dataKey: idB, name: "Alex" },
    ]);
  });

  it("fills absent leads with zero across multiple periods", () => {
    const { data } = buildLeadSubmissionsTableData([
      {
        ...{ periodStart: "2026-07-14", periodEnd: "2026-07-20" },
        leads: [{ leadId: "lead-a", leadName: "Lead A", submittedSections: 2 }],
      },
      {
        ...{ periodStart: "2026-07-21", periodEnd: "2026-07-27" },
        leads: [{ leadId: "lead-b", leadName: "Lead B", submittedSections: 3 }],
      },
    ]);

    expect(data).toEqual([
      {
        periodStart: "2026-07-14",
        periodEnd: "2026-07-20",
        "lead-a": 2,
        "lead-b": 0,
      },
      {
        periodStart: "2026-07-21",
        periodEnd: "2026-07-27",
        "lead-a": 0,
        "lead-b": 3,
      },
    ]);
  });
});

describe("PeriodComparisonTable", () => {
  it("renders the empty-state message when no rows", () => {
    render(
      <PeriodComparisonTable
        headingId="comparison-heading"
        rows={[]}
        periodA={{ periodStart: "2026-08-17", periodEnd: "2026-08-23" }}
        periodB={{ periodStart: "2026-08-24", periodEnd: "2026-08-30" }}
      />,
    );
    expect(screen.getByText(/no comparison data/i)).toBeInTheDocument();
  });

  it("renders missing status as No status and zero risks as 0", () => {
    render(
      <PeriodComparisonTable
        headingId="comparison-heading"
        periodA={{ periodStart: "2026-08-17", periodEnd: "2026-08-23" }}
        periodB={{ periodStart: "2026-08-24", periodEnd: "2026-08-30" }}
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
    // zero risk change is a dash in the normal foreground color, not grey 0
    const dash = screen.getByText("\u2014");
    expect(dash.className).not.toContain("text-muted-foreground");
  });

  it.each([
    {
      periodA: { periodStart: "2026-08-17", periodEnd: "2026-08-23" },
      periodB: { periodStart: "2026-08-24", periodEnd: "2026-08-30" },
      explanation:
        "Periods Aug 17–23, 2026 (previous) and Aug 24–30, 2026 (latest). Risk change is latest minus previous.",
    },
    {
      periodA: { periodStart: "2026-08-24", periodEnd: "2026-08-30" },
      periodB: { periodStart: "2026-08-31", periodEnd: "2026-09-06" },
      explanation:
        "Periods Aug 24–30, 2026 (previous) and Aug 31–Sep 6, 2026 (latest). Risk change is latest minus previous.",
    },
  ])(
    "identifies $periodA → $periodB and labels the positive risk change",
    ({ periodA, periodB, explanation: expectedExplanation }) => {
      render(
        <PeriodComparisonTable
          headingId="comparison-heading"
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
        "Period comparison data",
      );
      const explanation = screen.getByText(expectedExplanation);
      expect(explanation.tagName).toBe("P");
      expect(explanation.closest('[role="region"]')).toBeNull();
      expect(
        screen.getByRole("columnheader", { name: "Previous status" }),
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Latest status" }),
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Risk change" }),
      ).toBeVisible();
      expect(
        screen.getAllByRole("columnheader").map((header) => header.textContent),
      ).toEqual([
        "Project",
        "Latest status",
        "Previous status",
        "Latest risks",
        "Previous risks",
        "Risk change",
      ]);
      expect(
        screen.getAllByRole("cell").map((cell) => cell.textContent),
      ).toEqual(["Blocked", "On track", "4", "1", "+3"]);
    },
  );
});

describe("History latest period", () => {
  it("counts every latest status with product badges, including missing values", () => {
    render(
      <TrafficLightHistoryTable
        headingId="history-heading"
        periods={periods}
        rows={[
          { projectId: "a", projectName: "A", statuses: ["red", "green"] },
          { projectId: "b", projectName: "B", statuses: ["red", "yellow"] },
          { projectId: "c", projectName: "C", statuses: ["green", "red"] },
          { projectId: "d", projectName: "D", statuses: ["red", null] },
          { projectId: "e", projectName: "E", statuses: ["red"] },
        ]}
      />,
    );
    const summary = screen.getByText(/Period/);
    expect(summary.closest('[role="region"]')).toBeNull();
    expect(summary.textContent).toBe(
      "Period Aug 24\u201330, 2026: 1 project blocked, 1 at risk, 1 on track, 2 no status",
    );
    const latest = screen.getByRole("columnheader", {
      name: "Aug 24\u201330, 2026",
    });
    expect(latest).toHaveClass("bg-[var(--color-surface-muted)]");
    expect(
      screen.getByRole("columnheader", { name: "Aug 17\u201323, 2026" }),
    ).not.toHaveClass("bg-[var(--color-surface-muted)]");
    for (const row of screen.getAllByRole("rowheader")) {
      const cells = within(expectDefined(row.closest("tr"))).getAllByRole(
        "cell",
      );
      expect(cells[0]).toHaveClass("bg-[var(--color-surface-muted)]");
      expect(cells[1]).not.toHaveClass("bg-[var(--color-surface-muted)]");
    }
  });

  it("omits zero-count groups and includes only latest-column counts", () => {
    render(
      <TrafficLightHistoryTable
        headingId="history-heading"
        periods={periods}
        rows={[
          { projectId: "a", projectName: "A", statuses: ["red", "green"] },
          { projectId: "b", projectName: "B", statuses: ["yellow", "green"] },
        ]}
      />,
    );
    expect(screen.getByText(/Period/).textContent).toBe(
      "Period Aug 24\u201330, 2026: 2 projects on track",
    );
  });

  const transitions: readonly [
    TrafficLightStatus | null | undefined,
    TrafficLightStatus | null | undefined,
    string | null,
  ][] = [
    ["red", "yellow", "Recovered"],
    ["red", "green", "Recovered"],
    ["yellow", "green", "Recovered"],
    ["green", "yellow", "Slipped"],
    ["green", "red", "Slipped"],
    ["yellow", "red", "Slipped"],
    ["red", "red", null],
    ["yellow", "yellow", null],
    ["green", "green", null],
    [null, "red", null],
    ["green", null, null],
    [null, null, null],
    [undefined, "red", null],
    ["green", undefined, null],
    [undefined, undefined, null],
  ];
  it.each(transitions)(
    "marks %s → %s as %s only in the latest cell",
    (previous, latest, word) => {
      const statuses: TrafficLightHistoryOutput["rows"][number]["statuses"] = [
        previous ?? null,
        latest ?? null,
      ];
      render(
        <TrafficLightHistoryTable
          headingId="history-heading"
          periods={periods}
          rows={[
            {
              projectId: "a",
              projectName: "A",
              statuses: latest === undefined ? statuses.slice(0, 1) : statuses,
            },
          ]}
        />,
      );
      const cells = screen.getAllByRole("cell");
      expect(cells[1]).not.toHaveTextContent(/Recovered|Slipped/);
      if (word === null) {
        expect(cells[0]).not.toHaveTextContent(/Recovered|Slipped/);
      } else {
        const marker = within(expectDefined(cells[0])).getByText(word);
        expect(marker).toHaveClass("text-muted-foreground");
        expect(marker.querySelector('[aria-hidden="true"]')).toHaveTextContent(
          word === "Recovered" ? "↑" : "↓",
        );
        expect(screen.getAllByText(word)).toHaveLength(1);
      }
    },
  );

  it("does not mark a single published period", () => {
    render(
      <TrafficLightHistoryTable
        headingId="history-heading"
        periods={[periods[0]]}
        rows={[{ projectId: "a", projectName: "A", statuses: ["red"] }]}
      />,
    );
    expect(screen.getByRole("cell")).not.toHaveTextContent(/Recovered|Slipped/);
    expect(
      screen.getByRole("columnheader", { name: "Aug 17\u201323, 2026" }),
    ).toBeVisible();
    expect(screen.queryByText(/Scroll horizontally/)).toBeNull();
  });
});

describe("Native table affordances", () => {
  it("keeps all captions hidden, names sticky and opaque, and statuses unwrapped", async () => {
    render(
      <>
        <h2 id="history-heading">Traffic-light history</h2>
        <TrafficLightHistoryTable
          headingId="history-heading"
          periods={periods}
          rows={[
            {
              projectId: "a",
              projectName: "Alpha",
              statuses: ["green", "green"],
            },
          ]}
        />
        <h2 id="lead-heading">Lead submissions</h2>
        <LeadSubmissionsTable
          headingId="lead-heading"
          rows={[
            {
              ...periods[0],
              leads: [
                { leadId: "a", leadName: "Alex", submittedSections: 1 },
                { leadId: "b", leadName: "Blair", submittedSections: 0 },
              ],
            },
          ]}
        />
        <h2 id="comparison-heading">Period comparison</h2>
        <PeriodComparisonTable
          headingId="comparison-heading"
          periodA={periods[0]}
          periodB={periods[1]}
          rows={[
            {
              projectId: "a",
              projectName: "Alpha",
              statusA: "yellow",
              statusB: "green",
              riskCountA: 1,
              riskCountB: 0,
              riskDelta: -1,
            },
          ]}
        />
      </>,
    );
    for (const table of screen.getAllByRole("table")) {
      expect(table.querySelector("caption")).toHaveClass("sr-only");
      for (const name of [
        within(table).getAllByRole("columnheader")[0],
        ...within(table).getAllByRole("rowheader"),
      ]) {
        expect(name).toHaveClass(
          "sticky",
          "left-0",
          "bg-[var(--color-background)]",
          "w-36",
          "max-w-36",
          "whitespace-normal",
          "break-words",
        );
        expect(name?.className).toMatch(/z-10|z-20/);
      }
      for (const cell of within(table).getAllByRole("cell")) {
        if (
          /On track|At risk|Blocked|No status|Submitted|Missing/.test(
            cell.textContent,
          )
        )
          expect(cell).toHaveClass("whitespace-nowrap");
      }
    }
    const submitted = screen.getByRole("cell", { name: "Submitted" });
    expect(submitted.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "✓",
    );
    expect(screen.getByRole("cell", { name: "Missing" })).toHaveClass(
      "text-muted-foreground",
    );
    const comparison = screen.getByRole("region", {
      name: "Period comparison",
    });
    expect(comparison).toHaveAttribute("tabindex", "0");
    expect(comparison).toHaveAttribute("aria-labelledby", "comparison-heading");
    expect(comparison).toHaveClass("focus-visible:ring-[var(--color-primary)]");
    expect(comparison).toHaveAttribute(
      "aria-describedby",
      "comparison-heading-scroll-hint",
    );
    expect(
      screen.getByText(/Scroll horizontally/, {
        selector: "#comparison-heading-scroll-hint",
      }),
    ).toHaveClass("text-xs", "sm:hidden");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(comparison).toHaveFocus();
  });
});

describe("Trends real frozen ranges", () => {
  const ranges = [
    {
      periodStart: "2026-06-17",
      periodEnd: "2026-06-17",
      label: "Jun 17–17, 2026",
    },
    {
      periodStart: "2026-06-17",
      periodEnd: "2026-06-23",
      label: "Jun 17–23, 2026",
    },
    {
      periodStart: "2026-06-17",
      periodEnd: "2026-07-16",
      label: "Jun 17–Jul 16, 2026",
    },
    {
      periodStart: "2026-06-17",
      periodEnd: "2026-07-17",
      label: "Jun 17–Jul 17, 2026",
    },
    {
      periodStart: "2026-12-20",
      periodEnd: "2027-01-19",
      label: "Dec 20, 2026–Jan 19, 2027",
    },
    {
      periodStart: "2026-06-17",
      periodEnd: "2027-06-17",
      label: "Jun 17, 2026–Jun 17, 2027",
    },
  ];
  it.each(ranges)(
    "renders $label in all three tables and the summary",
    ({ label, ...period }) => {
      render(
        <>
          <TrafficLightHistoryTable
            headingId="history-heading"
            periods={[period]}
            rows={[
              { projectId: "a", projectName: "Alpha", statuses: ["green"] },
            ]}
          />
          <LeadSubmissionsTable
            headingId="lead-heading"
            rows={[
              {
                ...period,
                leads: [
                  { leadId: "a", leadName: "Alex", submittedSections: 1 },
                ],
              },
            ]}
          />
          <PeriodComparisonTable
            headingId="comparison-heading"
            periodA={period}
            periodB={null}
            rows={[
              {
                projectId: "a",
                projectName: "Alpha",
                statusA: "green",
                statusB: null,
                riskCountA: 0,
                riskCountB: 0,
                riskDelta: 0,
              },
            ]}
          />
        </>,
      );
      expect(screen.getAllByRole("columnheader", { name: label })).toHaveLength(
        2,
      );
      expect(
        screen.getByText(`Period ${label}: 1 project on track`),
      ).toBeVisible();
      expect(
        screen.getByText(
          `Periods ${label} (previous) and — (latest). Risk change is latest minus previous.`,
        ),
      ).toBeVisible();
    },
  );
});
