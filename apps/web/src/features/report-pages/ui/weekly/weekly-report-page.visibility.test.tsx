import "@testing-library/jest-dom/vitest";

import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/lib/query/cache-keys", () => ({
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

  async function waitForReadyPage(): Promise<void> {
    await waitForElementToBeRemoved(() =>
      screen.queryByTestId("weekly-report-skeleton"),
    );
  }

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

  it("shows a tokenized focus indicator after lead overview navigation", async () => {
    renderWeeklyReportPage(makeWeeklyReportData("open"), {
      role: "head",
      scope: "lead",
    });
    await waitForReadyPage();

    const section = document.getElementById(`report-lead-${AUTHOR_ID_A}`);
    if (!section) throw new Error("Lead section was not rendered");
    expect(section).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-[var(--color-ring)]",
      "focus-visible:ring-offset-2",
    );

    const user = userEvent.setup();
    screen.getByTitle("Jump to Alice's section").focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(section).toHaveFocus());
  });

  it("shows the archive link for an empty open report", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });
    const emptyState = await screen.findByTestId("empty-report-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent(/no report content for week 16/i);
    expect(emptyState).toHaveTextContent(
      "No sections have been submitted for this period.",
    );
    expect(
      screen.getByRole("link", { name: /view report history/i }),
    ).toHaveAttribute("href", "/reports");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("reports an empty submitted section accurately while preserving publish eligibility", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        submissionCount: 1,
        totalLeads: 1,
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
            authorId: AUTHOR_ID_A,
            status: "submitted",
            submittedAt: new Date("2026-04-14T09:00:00Z"),
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            activities: [],
          },
        ],
      }),
    );
    expect(await screen.findByTestId("empty-report-state")).toHaveTextContent(
      "Submitted sections contain no report content.",
    );
    expect(screen.getByText(/Live.*1\/1 Submitted/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publish & lock/i }),
    ).toBeEnabled();
    expect(
      screen.queryByText(/No sections have been submitted/),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["open", false, "Live"],
    ["reopened", false, "Live"],
    ["published", false, "Published"],
    ["published", true, "Archived"],
    ["open", true, "Archived"],
  ] as const)(
    "labels %s (archived=%s) as %s",
    async (periodStatus, archived, label) => {
      renderWeeklyReportPage(makeWeeklyReportData(periodStatus, { archived }));
      expect(
        await screen.findByText(`${label} · 4/6 Submitted`),
      ).toBeInTheDocument();
    },
  );

  it("keeps the normal layout for an empty published report", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("published", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });
    await screen.findByRole("button", { name: /reopen period/i });
    expect(screen.queryByTestId("empty-report-state")).not.toBeInTheDocument();
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
                {
                  projectId: PRODUCT_ID_A,
                  projectName: "Product Alpha",
                  trafficLight: "green",
                },
              ],
              items: [
                {
                  id: "33333333-3333-4333-8333-aaaaaaaaaa01",
                  projectId: PRODUCT_ID_A,
                  type: "current",
                  text: "Draft task in progress",
                  tag: "Dev",
                  workflowStatus: "in_progress",
                  stageNames: ["Development"],
                  carriedOver: false,
                },
              ],
              risks: [],
              decisions: [],
            },
          ],
        }),
        submissionCount: 0,
      },
      { authorId: AUTHOR_ID_A },
    );
    await waitForReadyPage();
    expect(
      screen.queryByText("Draft task in progress"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-report-state")).not.toBeInTheDocument();
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
    await waitForReadyPage();
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
