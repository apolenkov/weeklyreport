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
import {
  buildEscalationsFromReadSections,
  buildPortfolioProductsFromSnapshotSections,
} from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import type { ReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
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
  it("scopes a submitted Product header while Portfolio keeps draft health and owners", async () => {
    const draft = {
      ...draftSection(),
      projects: [
        {
          projectId: PRODUCT_ID_A,
          projectName: "Product Alpha",
          trafficLight: "red" as const,
        },
      ],
      items: (draftSection().items ?? []).map((item) => ({
        ...item,
        projectId: PRODUCT_ID_A,
      })),
    } satisfies ReportSectionFixture;
    const submitted = submittedSection();
    const fixtureReport = makeWeeklyReportData("open", {
      portfolioOverview: [],
      leadSections: [draft, submitted],
    });
    const fullReport = {
      ...fixtureReport,
      portfolioOverview: buildPortfolioProductsFromSnapshotSections(
        fixtureReport.leadSections,
      ),
      escalations: buildEscalationsFromReadSections(fixtureReport.leadSections),
    };

    renderWeeklyReportPage(fullReport, { scope: "product" });
    await waitForReadyPage();

    const submittedProduct = expectDefined(accordionCard(PRODUCT_ID_A));
    const submittedHeader = within(submittedProduct).getByRole("button", {
      name: /Product Alpha/,
    });
    expect(submittedHeader).toHaveTextContent("On track");
    expect(submittedHeader).toHaveTextContent("Alice");
    expect(submittedHeader).not.toHaveTextContent("Bob");

    const fullPortfolio = screen.getByTitle("Open Product Alpha details");
    expect(fullPortfolio).toHaveTextContent("Blocked");
    expect(fullPortfolio).toHaveTextContent("Alice");
    expect(fullPortfolio).toHaveTextContent("Bob");
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
  it.each(["product", "lead"] as const)(
    "re-derives a co-owned red signal from the submitted section in %s scope",
    async (scope) => {
      const draft = {
        ...draftSection(),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Product Alpha",
            trafficLight: "red" as const,
          },
        ],
        items: [
          {
            id: "55555555-5555-4555-8555-bbbbbbbbbbb3",
            projectId: PRODUCT_ID_A,
            type: "current" as const,
            text: "Draft co-owner work",
            tag: "Dev",
            workflowStatus: "in_progress" as const,
            stageNames: ["Development"],
            carriedOver: false,
          },
        ],
      } satisfies ReportSectionFixture;
      const submitted = {
        ...submittedSection(),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Product Alpha",
            trafficLight: "red" as const,
          },
        ],
      } satisfies ReportSectionFixture;
      const fullReport = makeWeeklyReportData("open", {
        portfolioOverview: [
          {
            productId: PRODUCT_ID_A,
            productName: "Product Alpha",
            worstStatus: "red",
            stageCount: 1,
            leadNames: ["Bob", "Alice"],
            leadIds: [AUTHOR_ID_B, AUTHOR_ID_A],
          },
        ],
        leadSections: [draft, submitted],
        escalations: [],
      });
      const escalations = buildEscalationsFromReadSections(
        fullReport.leadSections,
      );
      expect(escalations.filter(({ type }) => type === "at_risk")).toEqual([
        expect.objectContaining({ leadName: "Bob" }),
      ]);

      renderWeeklyReportPage({ ...fullReport, escalations }, { scope });

      await waitForReadyPage();

      expect(screen.queryByText("Draft co-owner work")).not.toBeInTheDocument();
      expect(
        screen.getByText("Project Product Alpha is flagged red."),
      ).toBeInTheDocument();

      await userEvent.click(
        within(screen.getByRole("group", { name: "Section filter" })).getByRole(
          "button",
          { name: "All" },
        ),
      );

      expect(screen.getByText("Draft co-owner work")).toBeInTheDocument();
      expect(
        screen.getAllByText("Project Product Alpha is flagged red."),
      ).toHaveLength(1);
    },
  );
});
describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7) — 3", () => {
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
  it("overview navigation reveals and opens a product hidden by submitted-only", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
    );

    await waitForReadyPage();
    expect(accordionCard(PRODUCT_ID_B)).toBeNull();

    const draftCard = screen.getByRole("button", { name: /Product Beta/ });
    expect(draftCard).not.toHaveAttribute("aria-controls");
    await userEvent.click(draftCard);

    await waitFor(() => {
      const product = expectDefined(accordionCard(PRODUCT_ID_B));
      expect(product).not.toBeNull();
      expect(draftCard).toHaveAttribute(
        "aria-controls",
        `report-product-${PRODUCT_ID_B}`,
      );
      expect(
        within(product).getByRole("button", {
          name: /Product Beta/,
        }),
      ).toHaveAttribute("aria-expanded", "true");
    });
    expect(
      within(screen.getByRole("group", { name: "Section filter" })).getByRole(
        "button",
        { name: "All" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
