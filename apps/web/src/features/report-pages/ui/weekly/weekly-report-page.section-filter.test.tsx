// Submission-filter and empty-state behavior through the page harness.

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
  weeklyReportReadModelSchema,
} from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

// We mock cache-keys to verify invalidation cascade without actually inspecting
// react-query internals.
vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateDashboard: vi.fn(),
  invalidateLeadForm: vi.fn(),
  invalidateLeadHistory: vi.fn(),
  invalidatePeriodLifecycle: vi.fn(),
  invalidateReview: vi.fn(),
}));

// Mock toast so we can assert success/error feedback.
const toastSuccess = vi.fn();
const toastError = vi.fn();
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

// Mock Next.js navigation hooks consumed by the fallback PeriodNavigator. We
// don't drive route changes in these tests — just neutralize the hook calls.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/head/report",
}));

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import type { ReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { renderWeeklyReportPage } from "./weekly-report-page-test-harness";

// Submitted|All filters the rendered accordion only; header/portfolio/nav stay
// on full truth. Default submitted-only for access-holders on a live period.
const AUTHOR_ID_B = "11111111-1111-4111-8111-bbbbbbbbbbbb";

function submittedSection(): ReportSectionFixture {
  return {
    reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_A,
    authorName: "Alice",
    status: "submitted" as const,
    submittedAt: new Date("2026-04-14T09:00:00Z"),
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
        type: "current" as const,
        text: "Alice submitted work",
        tag: "Dev",
        workflowStatus: "done" as const,
        stageNames: ["Development"],
        carriedOver: false,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
  };
}

function draftSection(): ReportSectionFixture {
  return {
    reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_B,
    authorName: "Bob",
    status: "draft" as const,
    submittedAt: null,
    projects: [
      {
        projectId: PRODUCT_ID_B,
        projectName: "Product Beta",
        trafficLight: "green",
      },
    ],
    items: [
      {
        id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
        projectId: PRODUCT_ID_B,
        type: "current" as const,
        text: "Bob draft work",
        tag: "Dev",
        workflowStatus: "in_progress" as const,
        stageNames: ["Development"],
        carriedOver: false,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
  };
}

const TWO_PRODUCT_OVERVIEW = [
  {
    productId: PRODUCT_ID_A,
    productName: "Product Alpha",
    worstStatus: "green" as const,
    stageCount: 1,
    leadNames: ["Alice"],
    leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
  },
  {
    productId: PRODUCT_ID_B,
    productName: "Product Beta",
    worstStatus: "yellow" as const,
    stageCount: 1,
    leadNames: ["Bob"],
    leadIds: ["d4b211c1-c97a-5853-b0e3-68e82c3c1bd7"],
  },
];

describe("WeeklyReportPage — Submitted/All filter + anti-empty-state (§7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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

describe("WeeklyReportPage — red-only draft co-owner delivery", () => {
  it.each(["submitted-first", "draft-first"] as const)(
    "reveals draft own red panel without copying global attention, %s",
    async (order) => {
      const submitted = {
        ...submittedSection(),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Shared red product",
            trafficLight: "red" as const,
          },
        ],
      };
      const draft = {
        ...draftSection(),
        items: [],
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Shared red product",
            trafficLight: "red" as const,
          },
        ],
      };
      const data = makeWeeklyReportData("open", {
        leadSections:
          order === "submitted-first" ? [submitted, draft] : [draft, submitted],
        portfolioOverview: [],
      });
      const escalations = buildEscalationsFromReadSections(data.leadSections);
      expect(escalations.filter((row) => row.type === "at_risk")).toHaveLength(
        1,
      );
      renderWeeklyReportPage(
        weeklyReportReadModelSchema.parse({
          ...data,
          escalations,
          portfolioOverview: buildPortfolioProductsFromSnapshotSections(
            data.leadSections,
          ),
        }),
        { scope: "lead" },
      );
      await waitFor(() =>
        expect(
          screen.queryByTestId("weekly-report-skeleton"),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId("draft-hidden-signal")).toHaveTextContent(
        "1 section in draft",
      );
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: /show all/i }));
      const bob = document.getElementById(
        `report-lead-${AUTHOR_ID_B}-product-${PRODUCT_ID_A}`,
      );
      expect(bob).not.toBeNull();
      const alice = document.getElementById(
        `report-lead-${AUTHOR_ID_A}-product-${PRODUCT_ID_A}`,
      );
      expect(alice).not.toBeNull();
      if (!bob || !alice) throw new Error("Expected both own product panels");
      expect(
        within(bob).getByRole("button", { name: /shared red product/i }),
      ).toBeEnabled();
      await userEvent
        .setup()
        .click(
          within(bob).getByRole("button", { name: /shared red product/i }),
        );
      await userEvent
        .setup()
        .click(
          within(alice).getByRole("button", { name: /shared red product/i }),
        );
      expect(
        screen.getAllByText("Project Shared red product is flagged red."),
      ).toHaveLength(1);
      const representative = order === "submitted-first" ? alice : bob;
      const other = order === "submitted-first" ? bob : alice;
      expect(
        within(representative).getByText(
          "Project Shared red product is flagged red.",
        ),
      ).toBeInTheDocument();
      expect(
        within(other).queryByText("Project Shared red product is flagged red."),
      ).not.toBeInTheDocument();
    },
  );
});
