// @vitest-environment jsdom

import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MapWeeklyReportResult } from "../../../features/report-sections";

// Module mocks must be hoisted above the import-under-test.
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn((options: { queryKey?: unknown[] }) => {
      const reportId = options.queryKey?.[2];
      if (reportId === "report-b") {
        return {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
        };
      }
      if (reportId === "report-error") {
        return {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error("network unavailable"),
        };
      }
      return {
        data: {
          status: "open",
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
        },
        isLoading: false,
        isError: false,
        error: null,
      };
    }),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    pdfExport: {
      render: {
        queryOptions: ({
          jobId,
          reportId,
        }: {
          jobId: string;
          reportId: string;
        }) => ({
          queryKey: ["pdfExport.render", jobId, reportId],
        }),
      },
    },
  }),
}));

vi.mock("../../../features/report-sections", () => ({
  STATUS_BADGE: {
    "in-progress": { label: "In Progress" },
    completed: { label: "Completed" },
    blocked: { label: "Blocked" },
    "at-risk": { label: "At Risk" },
    planned: { label: "Planned" },
    paused: { label: "Paused" },
    postponed: { label: "Postponed" },
  },
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

function renderPage(reportId: string) {
  return render(
    <PrintReportTemplate reportId={reportId} jobId={`job-for-${reportId}`} />,
  );
}

describe("PrintReportTemplate — static CSS safety", () => {
  it("style textContent contains only static CSS keywords — no user-supplied interpolations", () => {
    const { container } = renderPage("report-123");
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
    const { container } = renderPage("report-456");
    const styleEl = container.querySelector("style");
    expect(styleEl).not.toBeNull();
    const css = styleEl?.innerHTML ?? "";

    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
    expect(css).not.toMatch(/javascript:/i);
    expect(css).not.toMatch(/expression\(/i);
  });

  it("__html value is identical regardless of reportId — confirms no prop-derived interpolation", () => {
    const { container: c1 } = renderPage("id-aaa");
    const { container: c2 } = renderPage("id-bbb");

    const css1 = c1.querySelector("style")?.innerHTML ?? "";
    const css2 = c2.querySelector("style")?.innerHTML ?? "";

    expect(css1).toBe(css2);
    // Sanity: the style must be non-empty (the invariant is only meaningful
    // if the block actually rendered).
    expect(css1.length).toBeGreaterThan(0);
  });

  it("style element innerHTML snapshot — any future user-data interpolation breaks this", () => {
    const { container } = renderPage("snapshot-test");
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

describe("PrintReportTemplate report-key transitions", () => {
  it("replaces report A output with the pending shell for report B", async () => {
    const rendered = renderPage("report-a");
    expect(screen.getByText(/W1, Jun 1 – Jun 7/)).toBeInTheDocument();

    rendered.rerender(
      <PrintReportTemplate reportId="report-b" jobId="job-for-report-b" />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/W1, Jun 1 – Jun 7/)).not.toBeInTheDocument();
    });
    expect(screen.getByText("Loading report report-b …")).toBeInTheDocument();
    expect(vi.mocked(useQuery).mock.lastCall?.[0]).toMatchObject({
      queryKey: ["pdfExport.render", "job-for-report-b", "report-b"],
    });
  });
});

describe("PrintReportTemplate render outcomes", () => {
  it("renders the loading marker without ready content", () => {
    const { container } = renderPage("report-b");

    expect(
      container.querySelector('[data-print-state="loading"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-print-state="ready"]')).toBeNull();
  });

  it("renders the terminal error marker", () => {
    const { container } = renderPage("report-error");

    expect(
      container.querySelector('[data-print-state="error"]'),
    ).not.toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Report could not be rendered",
    );
  });

  it("renders ready summary, portfolio, and product records", () => {
    const { container } = renderPage("report-ready");

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
