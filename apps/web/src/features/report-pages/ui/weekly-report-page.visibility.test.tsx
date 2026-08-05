import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
} from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

describe("WeeklyReportPage visibility states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("groups products under each lead for lead scope", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("open"), {
      role: "head",
      scope: "lead",
    });
    expect(
      await screen.findByRole("heading", { name: "Alice", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    expect(screen.queryByText("Portfolio Overview")).not.toBeInTheDocument();
  });

  it("shares the by-lead overview between head and viewer scopes", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("open"), {
      role: "viewer",
      scope: "lead",
    });
    expect(
      await screen.findByRole("heading", { name: "Alice", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    expect(
      document.getElementById(`report-lead-${AUTHOR_ID_A}`),
    ).not.toBeNull();
  });

  it("shows the archive link for an empty open report", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });
    const emptyState = await screen.findByTestId("empty-submissions-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent(/no submissions yet for week 16/i);
    expect(
      screen.getByRole("link", { name: /view archived reports in archive/i }),
    ).toHaveAttribute("href", "/reports?tab=published");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the normal layout for an empty published report", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("published", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });
    await screen.findByRole("button", { name: /reopen period/i });
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
  });

  it("hides draft content until Show all and keeps publishing gated", async () => {
    renderWeeklyReportPage(
      {
        ...makeWeeklyReportData("open", {
          portfolioOverview: [
            {
              productId: PRODUCT_ID_A,
              productName: "Product Alpha",
              worstStatus: "green",
              stageCount: 1,
              leadNames: ["Alice"],
              leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
            },
          ],
          leadSections: [
            {
              reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
              reportId: "11111111-1111-4111-8111-111111111111",
              authorId: AUTHOR_ID_A,
              authorName: "Alice",
              status: "draft",
              submittedAt: null,
              projects: [
                { projectId: PRODUCT_ID_A, projectName: "Product Alpha" },
              ],
              items: [
                {
                  id: "33333333-3333-4333-8333-aaaaaaaaaa01",
                  projectId: PRODUCT_ID_A,
                  type: "current",
                  text: "Draft task in progress",
                  tag: "Dev",
                  workflowStatus: "in_progress",
                  carriedOver: false,
                  completed: false,
                },
              ],
              risks: [],
              decisions: [],
              priorities: [],
            },
          ],
        }),
        submissionCount: 0,
      },
      { authorId: AUTHOR_ID_A },
    );
    await screen.findByRole("heading", { name: /status report/i });
    expect(
      screen.queryByText("Draft task in progress"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(
      await screen.findByText("Draft task in progress"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nothing to publish/i }),
    ).toBeInTheDocument();
  });

  it("lets viewers read published reports without period mutation actions", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("published"), {
      role: "viewer",
    });
    await screen.findByRole("heading", { name: /status report/i });
    expect(
      screen.getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^archive$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reopen period/i }),
    ).not.toBeInTheDocument();
  });
});
