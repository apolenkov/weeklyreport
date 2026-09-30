import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeeklyProductReport } from "../../../features/report-sections";
import type { PrintActivityReport } from "./print-activity-projection";
import { PrintProductSection } from "./print-product-section";
import { PrintActivityReports } from "./print-report-sections";
import { PrintReportStyles } from "./print-report-styles";

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
