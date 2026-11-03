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
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
} from "./__tests__/weekly-report-page-harness";
import {
  AUTHOR_ID_B,
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
  it("preserves a manually re-expanded product when navigating to another product", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
    );

    await waitForReadyPage();
    await userEvent.click(
      within(screen.getByRole("group", { name: "Section filter" })).getByRole(
        "button",
        { name: "All" },
      ),
    );

    const productA = expectDefined(accordionCard(PRODUCT_ID_A));
    const productAToggle = within(productA).getByRole("button", {
      name: /Product Alpha/,
    });
    await userEvent.click(screen.getByTitle("Open Product Alpha details"));
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(productAToggle);
    expect(productAToggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(screen.getByTitle("Open Product Beta details"));
    expect(productAToggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(screen.getByTitle("Open Product Alpha details"));
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(productAToggle);
    expect(productAToggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(productAToggle);
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(screen.getByTitle("Open Product Beta details"));
    expect(
      within(expectDefined(accordionCard(PRODUCT_ID_B))).getByRole("button", {
        name: /Product Beta/,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 2", () => {
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
  it("keeps an explicitly opened product visible after navigating elsewhere", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
    );

    await waitForReadyPage();
    await userEvent.click(screen.getByTitle("Open Product Alpha details"));
    const productAToggle = within(
      expectDefined(accordionCard(PRODUCT_ID_A)),
    ).getByRole("button", { name: /Product Alpha/ });
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(screen.getByTitle("Open Product Beta details"));
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");
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
  it("keeps product disclosure states unchanged during lead overview navigation", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("published", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
      { scope: "lead" },
    );

    await waitForReadyPage();
    const productAToggle = within(
      expectDefined(
        document.getElementById(
          `report-lead-${AUTHOR_ID_A}-product-${PRODUCT_ID_A}`,
        ),
      ),
    ).getByRole("button", { name: /Product Alpha/ });
    const productBToggle = within(
      expectDefined(
        document.getElementById(
          `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_B}`,
        ),
      ),
    ).getByRole("button", { name: /Product Beta/ });

    await userEvent.click(productAToggle);
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");
    expect(productBToggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(screen.getByTitle("Jump to Bob's section"));
    expect(productAToggle).toHaveAttribute("aria-expanded", "true");
    expect(productBToggle).toHaveAttribute("aria-expanded", "false");
  });
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 4", () => {
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
  it("all-draft live period shows the 'N in draft — Show all' signal, not the empty-state", async () => {
    renderWeeklyReportPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [expectDefined(TWO_PRODUCT_OVERVIEW[1])],
        leadSections: [draftSection()],
      }),
      submissionCount: 0,
    });

    await waitForReadyPage();

    // The accordion is empty under submitted-only, but the period is NOT
    // content-less — so the signal shows, never the misleading empty-state.
    expect(screen.getByTestId("draft-hidden-signal")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-report-state")).not.toBeInTheDocument();
    expect(accordionCard(PRODUCT_ID_B)).toBeNull();

    // Show all reveals the draft accordion.
    await userEvent.click(screen.getByRole("button", { name: /show all/i }));
    await waitFor(() => {
      expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
    });
  });
});
