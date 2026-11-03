import {
  toastError,
  toastSuccess,
} from "./weekly-report-page.section-filter.test-support";
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]): void => {
      toastSuccess(...args);
    },
    error: (...args: unknown[]): void => {
      toastError(...args);
    },
    info: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));
// @vitest-environment jsdom
// @vitest-environment jsdom
import { screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeWeeklyReportData,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { AUTHOR_ID_B } from "./weekly-report-page.section-filter.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });
  async function waitForReadyPage(): Promise<void> {
    await waitForElementToBeRemoved(() =>
      screen.queryByTestId("weekly-report-skeleton"),
    );
  }
  it("an activity-only draft section (no draft product content) still surfaces the 'N in draft — Show all' signal", async () => {
    // draftCount must count activity content, not only product groupings —
    // otherwise an activity-only draft is invisible to the recovery signal.
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "77777777-7777-4777-8777-777777777771",
            reportId: REPORT_ID,
            authorId: AUTHOR_ID_B,
            authorName: "Bob",
            status: "draft",
            submittedAt: null,
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            activities: [
              {
                activityId: "88888888-8888-4888-8888-888888888881",
                activityName: "Jira triage duty",
                status: "red",
                note: "Draft-only activity note",
              },
            ],
          },
        ],
      }),
      submissionCount: 0,
    });

    await waitForReadyPage();

    // The signal surfaces (not the misleading empty-state), and clicking
    // "Show all" reveals the activity-only draft section.
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-report-state")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("activity-status-strip"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft-only activity note")).toBeInTheDocument();
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });
  it("a genuinely content-less period shows the true empty-state and no filter", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    expect(await screen.findByTestId("empty-report-state")).toBeInTheDocument();
    // No draft is hidden and the toggle lives in the (unrendered) body branch.
    expect(screen.queryByTestId("draft-hidden-signal")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
  });
});
