import {
  toastError,
  toastSuccess,
} from "./weekly-report-page.review-archive.test-support";
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
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAcknowledgeableData,
  makeDraftOnlyReviewableData,
  makeMixedReviewableData,
  makeReviewableData,
  REVIEW_COMMENT_TEXT,
} from "./weekly-report-page.review-archive.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage — review-mode split (report-review-mode) — 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it.each(["published", "archived"] as const)(
    "reads frozen Activity labels without composers for %s",
    async (lifecycle) => {
      const base = makeReviewableData();
      const data = {
        ...base,
        ...(lifecycle === "published"
          ? {
              periodStatus: "published" as const,
              periodState: "published" as const,
            }
          : {}),
        archived: lifecycle === "archived",
        leadSections: base.leadSections.map((section) => ({
          ...section,
          projects: [],
          items: [],
          decisions: [],
          activities: [
            {
              activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              activityName: "Frozen catalogue",
              titleOverride: "Frozen weekly title",
              status: "yellow" as const,
              note: "Frozen weekly note",
              jiraAccounts: [],
              linkedProducts: [],
              derivedStatus: null,
              alarmFloor: null,
            },
          ],
          risks: [
            {
              id: "33333333-3333-4333-8333-aaaaaaaaaa01",
              activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              risk: "Frozen risk",
              severity: "blocked" as const,
              impact: "Saved impact",
              mitigation: "Saved mitigation",
              stageNames: [],
              comments: [
                {
                  id: "44444444-4444-4444-8444-aaaaaaaaaa01",
                  reviewerId: "head-user-id",
                  reviewerName: "Saved reviewer",
                  text: "Frozen comment",
                  createdAt: new Date("2026-04-15T10:00:00Z"),
                },
              ],
            },
          ],
        })),
      };
      const { captured } = renderWeeklyReportPage(data);
      await screen.findByText("Frozen weekly title");
      await userEvent.click(
        screen.getByRole("button", { name: /Frozen weekly title details/ }),
      );
      expect(screen.getByText("Frozen risk")).toBeInTheDocument();
      expect(screen.getByText("Frozen weekly note")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Review" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Frozen comment")).not.toBeInTheDocument();
      expect(captured["review.comment"]?.mutationFn).not.toHaveBeenCalled();
      expect(captured["review.verdict"]?.mutationFn).not.toHaveBeenCalled();
    },
  );
});
describe("WeeklyReportPage — review-mode split (report-review-mode) — 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("defaults to read mode: the toggle shows for a reviewer but affordances stay hidden", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "head" });

    expect(
      await screen.findByRole("button", { name: "Review" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Read mode renders read-only content — no verdict control, no composer, no
    // reviewer comments.
    expect(
      screen.queryByRole("button", { name: /^Approve /u }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Add a review comment/u),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(REVIEW_COMMENT_TEXT)).not.toBeInTheDocument();
    // The roll-up strip renders on the dashboard, not inside the report body.
    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).not.toBeInTheDocument();
  });
});
describe("WeeklyReportPage — review-mode split (report-review-mode) — 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("mounts the verdict control and comment composer once switched to review mode", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "head" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    expect(
      await screen.findByRole("button", { name: /^Approve /u }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Add a review comment/u)).toBeInTheDocument();
    expect(screen.getByText(REVIEW_COMMENT_TEXT)).toBeInTheDocument();
    // The in-body verdict band is the designated viewer-reviewer's verdict home.
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
  });
});
describe("WeeklyReportPage — review-mode split (report-review-mode) — 4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("gives a designated viewer-reviewer the in-body verdict home (not stranded by the head-only strip)", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "viewer" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    expect(
      await screen.findByRole("button", { name: /^Approve /u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toBeInTheDocument();
  });
});
describe("WeeklyReportPage — review-mode split (report-review-mode) — 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("offers no review-mode toggle to a lead", async () => {
    renderWeeklyReportPage(makeReviewableData(), { role: "lead" });

    await screen.findByRole("heading", { name: "Status Report" });
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Read" }),
    ).not.toBeInTheDocument();
  });
});
describe("WeeklyReportPage — review-mode split (report-review-mode) — 6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("offers no review-mode toggle for draft-only review capability", async () => {
    renderWeeklyReportPage(makeDraftOnlyReviewableData(), { role: "head" });

    await screen.findByRole("heading", { name: "Status Report" });
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).not.toBeInTheDocument();
  });
});
describe("WeeklyReportPage — review-mode split (report-review-mode) — 7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("keeps mixed review state limited to submitted sections", async () => {
    renderWeeklyReportPage(makeMixedReviewableData(), { role: "head" });

    await userEvent.click(
      await screen.findByRole("button", { name: "Review" }),
    );

    const band = await screen.findByRole("region", { name: "Section reviews" });
    expect(within(band).getByText("Alice")).toBeInTheDocument();
    expect(within(band).queryByText("Bob")).not.toBeInTheDocument();
    expect(
      within(band).getAllByRole("button", { name: /^Approve /u }),
    ).toHaveLength(1);
  });
});
describe("WeeklyReportPage — acknowledge placement — 8", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("head: Acknowledge sits in the publish cluster on the header, not as a body band", async () => {
    renderWeeklyReportPage(makeAcknowledgeableData(), { role: "head" });

    const cluster = await screen.findByTestId("acknowledge-header");
    expect(
      within(cluster).getByRole("button", { name: /acknowledge/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("acknowledge-body")).not.toBeInTheDocument();
    // Acknowledgement never gates publish: the lifecycle button still renders
    // alongside, un-acknowledged.
    expect(
      screen.getByRole("button", { name: /publish/i }),
    ).toBeInTheDocument();
  });
});
describe("WeeklyReportPage — acknowledge placement — 9", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it("viewer: Acknowledge stays a body band (no publish cluster to host it)", async () => {
    renderWeeklyReportPage(makeAcknowledgeableData(), { role: "viewer" });

    const band = await screen.findByTestId("acknowledge-body");
    expect(
      within(band).getByRole("button", { name: /acknowledge/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("acknowledge-header")).not.toBeInTheDocument();
  });
});
