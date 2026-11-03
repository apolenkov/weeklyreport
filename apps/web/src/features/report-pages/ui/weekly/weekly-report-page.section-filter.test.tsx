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
import { buildEscalationsFromReadSections } from "@weeklyreport/shared";
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
  it("defaults to submitted-only: a draft-only product is hidden until Show all reveals it", async () => {
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
    );

    await waitForReadyPage();

    // Submitted product's accordion renders; the draft-only one does not.
    expect(accordionCard(PRODUCT_ID_A)).not.toBeNull();
    expect(accordionCard(PRODUCT_ID_B)).toBeNull();

    // TRUTH invariant: the filter narrows the ACCORDION only. The header
    // submission count and the portfolio overview band keep reporting all
    // sections — the hidden draft product still shows as an overview card
    // (a button; its accordion counterpart above is asserted null).
    expect(screen.getByText(/4\/6 Submitted/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Product Beta/ }),
    ).toBeInTheDocument();

    // The filter toggle is present (live period, head) and the draft-hidden
    // signal names the one hidden section.
    const toggle = screen.getByRole("group", { name: "Section filter" });
    expect(toggle).toBeInTheDocument();
    expect(screen.getByTestId("draft-hidden-signal")).toHaveTextContent(
      /1 section in draft/i,
    );

    // Flip to All → the draft product's accordion appears.
    await userEvent.click(within(toggle).getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
    });
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
  it("uses short lead labels in lead scope while retaining raw identity for navigation", async () => {
    const rawName = "Иванова Алиса Петровна";
    renderWeeklyReportPage(
      makeWeeklyReportData("open", {
        portfolioOverview: [
          {
            ...expectDefined(TWO_PRODUCT_OVERVIEW[0]),
            leadNames: [rawName],
          },
        ],
        leadSections: [{ ...submittedSection(), authorName: rawName }],
      }),
      { scope: "lead" },
    );

    await waitForReadyPage();

    const overview = screen.getByTitle(`Jump to ${rawName}'s section`);
    expect(overview).toHaveTextContent("Иванова А.П.");
    expect(
      screen.getByRole("region", { name: "Иванова А.П." }),
    ).toHaveTextContent("Иванова А.П.");
    expect(screen.queryByText(rawName)).toBeNull();
    const leadSection = expectDefined(
      document.getElementById(`report-lead-${AUTHOR_ID_A}`),
    );
    const scrollIntoView = vi.mocked(
      window.HTMLElement.prototype.scrollIntoView,
    );

    await userEvent.click(overview);
    await waitFor(() => {
      expect(leadSection).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(overview);
    await waitFor(() => {
      expect(leadSection).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });
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
  it.each(["product", "lead"] as const)(
    "scopes derived signals to submitted sections in %s scope while keeping the full portfolio",
    async (scope) => {
      const submitted = {
        ...submittedSection(),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Product Alpha",
            trafficLight: "green" as const,
            ownedStages: [
              {
                stageId: "33333333-3333-4333-8333-aaaaaaaaaa10",
                stageName: "Development",
                sortOrder: 0,
                status: "green" as const,
              },
            ],
          },
        ],
        items: [],
        risks: [
          {
            id: "33333333-3333-4333-8333-aaaaaaaaaa11",
            projectId: PRODUCT_ID_A,
            risk: "Submitted release blocker",
            impact: "Release stops",
            mitigation: "Escalate",
            severity: "blocked" as const,
            stageNames: ["Development"],
          },
          {
            id: "33333333-3333-4333-8333-aaaaaaaaaa12",
            projectId: PRODUCT_ID_A,
            risk: "Submitted capacity risk",
            impact: "Latency rises",
            mitigation: "Scale out",
            severity: "at-risk" as const,
            stageNames: ["Testing"],
          },
        ],
      } satisfies ReportSectionFixture;
      const draft = {
        ...draftSection(),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Product Alpha",
            trafficLight: "green" as const,
          },
        ],
        items: [],
        risks: [
          {
            id: "55555555-5555-4555-8555-bbbbbbbbbbb2",
            projectId: PRODUCT_ID_A,
            risk: "Draft vendor outage",
            impact: "Requests fail",
            mitigation: "Use fallback",
            severity: "blocked" as const,
            stageNames: ["Development"],
          },
        ],
      } satisfies ReportSectionFixture;

      const fullReport = makeWeeklyReportData("open", {
        portfolioOverview: [
          {
            productId: PRODUCT_ID_A,
            productName: "Product Alpha",
            worstStatus: "red",
            stageCount: 2,
            leadNames: ["Alice", "Bob"],
            leadIds: [AUTHOR_ID_A, AUTHOR_ID_B],
          },
        ],
        leadSections: [submitted, draft],
        escalations: [],
      });
      const escalations = buildEscalationsFromReadSections(
        fullReport.leadSections,
      );
      expect(escalations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "at_risk",
            leadName: "Alice",
            description: "Project Product Alpha is flagged red.",
          }),
          expect.objectContaining({
            type: "blocked",
            description: "Submitted release blocker",
          }),
          expect.objectContaining({
            type: "unresolved_risk",
            description: "Submitted capacity risk",
          }),
        ]),
      );
      renderWeeklyReportPage({ ...fullReport, escalations }, { scope });

      await waitForReadyPage();

      const overview =
        scope === "product"
          ? screen.getByTitle("Open Product Alpha details")
          : null;
      if (overview) expect(overview).toHaveTextContent("3 risks");
      expect(screen.queryByText("Draft vendor outage")).not.toBeInTheDocument();
      expect(screen.getByText("Submitted release blocker")).toBeInTheDocument();
      expect(screen.getByText("Submitted capacity risk")).toBeInTheDocument();

      await userEvent.click(
        within(screen.getByRole("group", { name: "Section filter" })).getByRole(
          "button",
          { name: "All" },
        ),
      );

      expect(screen.getAllByText("Draft vendor outage")).toHaveLength(1);
      if (overview) expect(overview).toHaveTextContent("3 risks");
    },
  );
});
