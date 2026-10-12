import { weeklyReportReadModelSchema } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyProductReport } from "../../../features/report-sections";
import { mapWeeklyReport } from "../../../features/report-sections/model/weekly-report";
import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";
import type { PrintActivityReport } from "./print-activity-projection";
import { PrintProductSection } from "./print-product-section";
import {
  PrintActivityReports,
  PrintProductReports,
} from "./print-report-sections";
import { PrintReportStyles } from "./print-report-styles";
import { PrintReportTemplate } from "./print-report-template";

function boundedValue(start: string, end: string, length: number): string {
  return `${start}${"X".repeat(length - start.length - end.length)}${end}`;
}

const LONG_ACTIVITY_NAME = boundedValue(
  "[F-ACTIVITY-NAME-S]",
  "[F-ACTIVITY-NAME-E]",
  200,
);
const LONG_CONTRIBUTOR_NAME = boundedValue(
  "[F-CONTRIBUTOR-S]",
  "[F-CONTRIBUTOR-E]",
  200,
);
const LONG_RECORD_TEXT = boundedValue("[F-ITEM-S]", "[F-ITEM-E]", 500);
const LONG_ATTENTION_TEXT = boundedValue("[F-RISK-S]", "[F-RISK-E]", 500);

function makeProductReport(): WeeklyProductReport {
  return {
    id: "product-boundary",
    authorIds: ["author-boundary"],
    initials: "PB",
    name: LONG_ACTIVITY_NAME,
    status: "blocked",
    statusLabel: "Blocked",
    leads: LONG_CONTRIBUTOR_NAME,
    needsAttention: LONG_ATTENTION_TEXT,
    needsAttentionSeverity: "blocked",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

function makeActivityReport(): PrintActivityReport {
  return {
    id: "activity-boundary",
    name: LONG_ACTIVITY_NAME,
    status: "at-risk",
    contributors: [
      {
        id: "author-boundary",
        name: LONG_CONTRIBUTOR_NAME,
        initials: "LC",
      },
    ],
    presentations: [
      {
        reportSectionId: "section-boundary",
        authorId: "author-boundary",
        authorName: LONG_CONTRIBUTOR_NAME,
        title: LONG_ACTIVITY_NAME,
        note: "Frozen weekly description",
      },
    ],
    currentWeek: [
      {
        id: "item-boundary",
        stageLead: `${LONG_ACTIVITY_NAME} · LC`,
        stage: LONG_ACTIVITY_NAME,
        owner: "LC",
        text: LONG_RECORD_TEXT,
        status: "in-progress",
        authorId: "author-boundary",
        authorName: LONG_CONTRIBUTOR_NAME,
      },
    ],
    nextWeek: [],
    risks: [],
    decisions: [],
  };
}

describe("print layout boundaries", () => {
  it("omits an empty Product section from a schema-admitted published report", () => {
    const source = weeklyReportReadModelSchema.parse(
      makeWeeklyReportFixture({
        periodState: "published",
        periodStatus: "published",
      }),
    );
    const view = mapWeeklyReport(source);
    expect(view.products).toEqual([]);
    const { container } = render(<PrintProductReports view={view} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("retains the Product heading, break and first entity for a nonempty report", () => {
    const source = weeklyReportReadModelSchema.parse(
      makeWeeklyReportFixture({
        periodState: "published",
        periodStatus: "published",
        portfolioOverview: [
          {
            productId: "10000000-0000-4000-8000-000000000004",
            productName: "Core product",
            worstStatus: "green",
            stageCount: 0,
            leadNames: [],
            leadIds: [],
          },
        ],
      }),
    );
    const view = mapWeeklyReport(source);
    expect(view.products).toHaveLength(1);
    const { container } = render(<PrintProductReports view={view} />);
    expect(container.querySelectorAll(".page-break-before")).toHaveLength(1);
    const heading = screen.getByRole("heading", { name: "Product Reports" });
    expect(heading.nextElementSibling).toContainElement(
      screen.getByRole("heading", { name: "Core product" }),
    );
  });

  it("keeps Activity content in the real template for an activity-only published source", () => {
    const source = weeklyReportReadModelSchema.parse(
      makeWeeklyReportFixture({
        periodState: "published",
        periodStatus: "published",
        submissionCount: 1,
        totalLeads: 1,
        leadSections: [
          {
            status: "submitted",
            submittedAt: new Date("2026-04-20T12:00:00Z"),
            activities: [
              {
                activityId: "10000000-0000-4000-8000-000000000005",
                activityName: "Support rotation",
                status: "green",
              },
            ],
          },
        ],
      }),
    );
    expect(mapWeeklyReport(source).products).toEqual([]);
    const { container } = render(<PrintReportTemplate data={source} />);
    expect(
      screen.queryByRole("heading", { name: "Product Reports" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".page-break-before")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Activity Reports" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Support rotation" }),
    ).toBeInTheDocument();
  });

  it("preserves complete bounded product text and every header field", () => {
    render(<PrintProductSection report={makeProductReport()} />);

    const title = screen.getByRole("heading", { name: LONG_ACTIVITY_NAME });
    const header = title.parentElement;
    const attention = screen.getByText(LONG_ATTENTION_TEXT);
    const contributor = screen.getByText(LONG_CONTRIBUTOR_NAME);

    expect(header).toHaveClass("print-entity-header");
    expect(title).toHaveStyle({ minWidth: 0, overflowWrap: "anywhere" });
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(contributor).toHaveStyle({
      minWidth: 0,
      overflowWrap: "anywhere",
    });
    expect(attention).toHaveTextContent(LONG_ATTENTION_TEXT);
    expect(attention).toHaveStyle({ overflowWrap: "anywhere" });
    expect(title.closest("section")?.getAttribute("style") ?? "").not.toContain(
      "page-break-inside",
    );
  });

  it("keeps the Activity heading linked to complete first-report content", () => {
    const { container } = render(
      <>
        <PrintReportStyles />
        <PrintActivityReports reports={[makeActivityReport()]} />
      </>,
    );

    const reportsHeading = screen.getByRole("heading", {
      name: "Activity Reports",
    });
    const firstReport = reportsHeading.nextElementSibling;
    const activityHeading = screen.getByRole("heading", {
      name: LONG_ACTIVITY_NAME,
    });
    const entityHeader = activityHeading.parentElement;

    expect(reportsHeading).toHaveClass("print-section-heading");
    expect(firstReport?.tagName).toBe("SECTION");
    expect(firstReport?.firstElementChild).toBe(entityHeader);
    expect(entityHeader).toHaveClass("print-entity-header");
    expect(activityHeading).toHaveStyle({
      minWidth: 0,
      overflowWrap: "anywhere",
    });
    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByText(LONG_CONTRIBUTOR_NAME)).toHaveStyle({
      minWidth: 0,
      overflowWrap: "anywhere",
    });
    expect(screen.getByText(LONG_RECORD_TEXT)).toBeInTheDocument();
    expect(screen.getByText("Frozen weekly description")).toBeInTheDocument();
    expect(firstReport?.getAttribute("style") ?? "").not.toContain(
      "page-break-inside",
    );

    const printCss = container.querySelector("style")?.textContent ?? "";
    expect(printCss).toMatch(
      /\.print-section-heading[^{]*\bh4\b[^{]*\{[^}]*break-after:\s*avoid/,
    );
    // The app body texture must not leak into the printed margins.
    expect(printCss).toMatch(/html,\s*body\s*\{[^}]*background:\s*#fff/);
    expect(printCss).not.toMatch(/section\s*\{[^}]*page-break-inside:\s*avoid/);
  });
});
