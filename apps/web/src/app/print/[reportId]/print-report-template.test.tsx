// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MapWeeklyReportResult } from "../../../features/report-sections/model/weekly-report";

// Module mocks must be hoisted above the import-under-test.
vi.mock("../../../features/report-sections/model/weekly-report", () => ({
  mapWeeklyReport: () =>
    ({
      portfolio: [
        {
          id: "product-1",
          initials: "CO",
          name: "Core",
          hasContent: true,
          status: "at-risk",
          statusLabel: "At Risk · Alex Lead",
          leads: "Alex Lead",
          currentWeekCount: 1,
          nextWeekCount: 1,
          riskCount: 1,
        },
      ],
      products: [
        {
          id: "product-1",
          authorIds: ["author-1"],
          initials: "CO",
          name: "Core",
          status: "at-risk",
          statusLabel: "At Risk",
          leads: "Alex Lead",
          currentWeek: [
            {
              id: "item-1",
              stageLead: "Build · AL",
              stage: "Build",
              owner: "AL",
              text: "Ship release",
              status: "in-progress",
            },
          ],
          nextWeek: [],
          risks: [],
          decisions: [
            {
              id: "decision-1",
              badge: "Core",
              owner: "AL",
              text: "Approve",
            },
          ],
          priorities: [],
        },
      ],
      submissionCount: 1,
      totalLeads: 2,
      submissionLabel: "1/2 submitted",
      periodStatus: "open",
      period: {
        id: "p1",
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
        reportId: "r1",
        periodState: "open" as const,
        periodStatus: "open" as const,
        archived: false,
        weekLabel: "W1",
        dateRange: "Jun 1 – Jun 7",
        isCurrent: true,
      },
    }) satisfies MapWeeklyReportResult,
}));

import { PrintReportTemplate } from "./print-report-template";

const DATA = {
  leadSections: [
    {
      reportSectionId: "section-activity",
      authorId: "author-activity",
      authorName: "Taylor Reed",
      activities: [
        {
          activityId: "activity-1",
          activityName: "Support rotation",
          status: "yellow",
          derivedStatus: "yellow",
        },
      ],
      items: [
        {
          id: "activity-item-1",
          activityId: "activity-1",
          type: "next",
          text: "Cover launch support",
          workflowStatus: "postponed",
          priorityRank: 2,
        },
      ],
      risks: [
        {
          id: "activity-risk-1",
          activityId: "activity-1",
          risk: "Coverage gap",
          impact: "Slow response",
          mitigation: "Add backup",
          severity: "at-risk",
        },
      ],
      decisions: [
        {
          id: "activity-decision-1",
          activityId: "activity-1",
          text: "Approve backup rotation",
        },
      ],
    },
  ],
} as never;

function renderPage() {
  return render(<PrintReportTemplate data={DATA} />);
}

describe("PrintReportTemplate — static CSS safety", () => {
  it("style textContent contains only static CSS keywords — no user-supplied interpolations", () => {
    const { container } = renderPage();
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    const css = styleEl?.textContent ?? "";

    expect(css).toContain("@media print");
    expect(css).toContain("@page");
    expect(css).toContain("body nav");
    expect(css).toContain(".no-print");
    expect(css).toContain("page-break");
  });

  it("style innerHTML does not contain script-injectable patterns — no XSS vector", () => {
    const { container } = renderPage();
    const styleEl = container.querySelector("style");
    const css = styleEl?.innerHTML ?? "";

    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
    expect(css).not.toMatch(/javascript:/i);
    expect(css).not.toMatch(/expression\(/i);
  });

  it("style element innerHTML snapshot — any future user-data interpolation breaks this", () => {
    const { container } = renderPage();
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.innerHTML).toMatchInlineSnapshot(`
      "
                  @media print {
                    body { margin: 0; padding: 0; }
                    body nav, body .no-print { display: none; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page-break-before { page-break-before: always; }
                    .print-section-heading, .print-entity-header {
                      break-after: avoid-page;
                      page-break-after: avoid;
                    }
                    .print-entity-header {
                      break-inside: avoid;
                      page-break-inside: avoid;
                    }
                    table { page-break-inside: avoid; }
                  }
                  @page {
                    size: A4;
                    margin: 15mm;
                  }
                "
    `);
  });
});

describe("PrintReportTemplate render outcome", () => {
  it("renders the ready marker plus summary, portfolio, and product records from SSR data", () => {
    const { container } = renderPage();

    expect(
      container.querySelector('[data-print-state="ready"]'),
    ).not.toBeNull();
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Overview")).toBeInTheDocument();
    expect(screen.getByText("Product Reports")).toBeInTheDocument();
    expect(screen.getByText("Activity Reports")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Support rotation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cover launch support")).toBeInTheDocument();
    expect(
      screen.getByText(/Coverage gap.*Impact: Slow response/),
    ).toBeInTheDocument();
    expect(screen.getByText("Approve backup rotation")).toBeInTheDocument();
    expect(screen.getByText("Postponed")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("Taylor Reed")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Core" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Core" })).toBeInTheDocument();
    expect(screen.getByText("Ship release")).toBeInTheDocument();
    expect(container.querySelector("header")).toHaveTextContent(
      "1/2 leads submitted",
    );
    expect(
      screen.getByText("At-risk products / activities").parentElement,
    ).toHaveTextContent("2");
    expect(screen.getByText("Decisions").parentElement).toHaveTextContent("2");
  });
});
