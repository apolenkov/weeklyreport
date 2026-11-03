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
import {
  screen,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import {
  draftSection,
  submittedSection,
  TWO_PRODUCT_OVERVIEW,
} from "./weekly-report-page.section-filter.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });
  function accordionCard(productId: string): HTMLElement | null {
    return document.getElementById(`report-product-${productId}`);
  }
  async function waitForReadyPage(): Promise<void> {
    await waitForElementToBeRemoved(() =>
      screen.queryByTestId("weekly-report-skeleton"),
    );
  }
  it("published snapshot renders unfiltered with no filter toggle", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("published", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
    );

    await waitForReadyPage();

    // Published is never filtered: BOTH products' accordions render and the
    // toggle is absent.
    expect(accordionCard(PRODUCT_ID_A)).not.toBeNull();
    expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("draft-hidden-signal")).not.toBeInTheDocument();
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 2", () => {
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
  it("hides a draft section's activity statuses under submitted-only, reveals them via Show all", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [
          submittedSection(),
          {
            ...draftSection(),
            activities: [
              {
                activityId: "66666666-6666-4666-8666-666666666666",
                activityName: "Jira triage duty",
                status: "red" as const,
                note: "Draft-only vendor note",
              },
            ],
          },
        ],
      }),
    );

    await waitForReadyPage();

    // Only the draft carries activities, so under the submitted-only default
    // the strip self-suppresses — no draft status or note leaks.
    expect(
      screen.queryByTestId("activity-status-strip"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Draft-only vendor note"),
    ).not.toBeInTheDocument();

    // Show all reveals the draft author's activity row.
    const toggle = screen.getByRole("group", { name: "Section filter" });
    await userEvent.click(within(toggle).getByRole("button", { name: "All" }));
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();
    expect(screen.getByText("Draft-only vendor note")).toBeInTheDocument();
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 3", () => {
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
  it("activity-first-class: an all-activity submitted period renders (no empty-state) and can publish", async () => {
    // A touched activity counts as report content even without product rows.
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
            reportId: REPORT_ID,
            authorId: AUTHOR_ID_A,
            authorName: "Alice",
            status: "submitted",
            submittedAt: new Date("2026-04-14T09:00:00Z"),
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            activities: [
              {
                activityId: "66666666-6666-4666-8666-666666666666",
                activityName: "Jira triage duty",
                status: "green",
                note: "Handled 20 tickets",
              },
            ],
          },
        ],
      }),
      submissionCount: 1,
    });

    await waitForReadyPage();

    // The truly-empty-period empty-state must NOT show — there is real content.
    expect(screen.queryByTestId("empty-report-state")).not.toBeInTheDocument();

    // The submitted activity renders under the default submitted-only view.
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();

    // The submitted section satisfies the publish lifecycle gate.
    const publish = screen.getByRole("button", { name: /publish & lock/i });
    expect(publish).not.toBeDisabled();
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });
  it("activity-first-class: a seeded-but-untouched green activity does NOT defeat the empty-state", async () => {
    // Guards the touched-vs-seeded distinction: seedActivityStatuses defaults an
    // attached activity to status "green" (never null) on section create, so a
    // lead who only logged in — green activity, no note, no records, no product
    // content — is still an empty period. It must show the no-content state, not
    // render a scaffold of seeded-green activity cards.
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
            reportId: REPORT_ID,
            authorId: AUTHOR_ID_A,
            authorName: "Alice",
            status: "draft",
            submittedAt: null,
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            activities: [
              {
                activityId: "66666666-6666-4666-8666-666666666666",
                activityName: "Jira triage duty",
                status: "green",
                note: null,
              },
            ],
          },
        ],
      }),
      submissionCount: 0,
    });

    expect(await screen.findByTestId("empty-report-state")).toBeInTheDocument();
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });
  function accordionCard(productId: string): HTMLElement | null {
    return document.getElementById(`report-product-${productId}`);
  }
  async function waitForReadyPage(): Promise<void> {
    await waitForElementToBeRemoved(() =>
      screen.queryByTestId("weekly-report-skeleton"),
    );
  }
  it("does not offer the filter to a lead on a live period", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
      { role: "lead" },
    );

    await waitForReadyPage();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
    // A lead sees content unfiltered (no submitted-only narrowing).
    expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
  });
});
