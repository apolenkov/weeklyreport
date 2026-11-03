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
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
} from "./__tests__/weekly-report-page-harness";
import {
  draftSection,
  submittedSection,
  TWO_PRODUCT_OVERVIEW,
} from "./weekly-report-page.section-filter.test-support";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";
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
  it("reopens and scrolls the same product on repeated overview navigation", async () => {
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

    const overviewCard = screen.getByTitle("Open Product Alpha details");
    const product = expectDefined(accordionCard(PRODUCT_ID_A));
    const productToggle = within(product).getByRole("button", {
      name: /Product Alpha/,
    });
    const scrollIntoView = vi.mocked(
      window.HTMLElement.prototype.scrollIntoView,
    );
    const otherProductToggle = within(
      expectDefined(accordionCard(PRODUCT_ID_B)),
    ).getByRole("button", { name: /Product Beta/ });
    await userEvent.click(otherProductToggle);
    expect(otherProductToggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(overviewCard);
    await waitFor(() => {
      expect(productToggle).toHaveAttribute("aria-expanded", "true");
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect(otherProductToggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(productToggle);
    expect(productToggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(overviewCard);
    await waitFor(() => {
      expect(productToggle).toHaveAttribute("aria-expanded", "true");
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });
    expect(otherProductToggle).toHaveAttribute("aria-expanded", "true");
  });
});
