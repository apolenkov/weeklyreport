// Wire-up tests: tRPC stub intercepts publish/reopen/get; no MSW handlers.
// Assert mutation variables, cache invalidation, and toast on success.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";

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

import {
  SessionContext,
  type SessionUser,
} from "../../../../shared/lib/auth/session-provider";
import { expectDefined } from "../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import {
  AUTHOR_ID_A,
  makeWeeklyReportData,
  PRODUCT_ID_A,
  PRODUCT_ID_B,
  REPORT_ID,
} from "./__tests__/weekly-report-page-harness";
import { WeeklyReportPage } from "./weekly-report-page";

function renderPage(
  data: ReturnType<typeof makeWeeklyReportData>,
  authorId?: string,
  role: SessionUser["role"] = "head",
  scope?: "product" | "lead",
  documentActionsLeading?: ReactNode,
  contextControls?: ReactNode,
  contextControlsLeading?: ReactNode,
) {
  const { proxy, captured } = createMockTRPC([
    { path: ["weeklyReport", "get"], query: data },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    // ExportPdfButton calls both pdfExport.request.mutationOptions
    // and pdfExport.status.queryOptions unconditionally on every render. Mock the
    // surface here so the parent page renders without throwing — these tests do
    // not exercise PDF export behavior, they only need the mock to be structurally
    // valid. pdfExport.status has enabled:false in the component; the factory
    // stub without enabled is fine because the component manages enabled itself.
    { path: ["pdfExport", "request"], mutation: true },
    { path: ["pdfExport", "status"], query: null },
    { path: ["review", "dashboard"] },
    { path: ["review", "verdict"], mutation: true },
    { path: ["review", "comment"], mutation: true },
    { path: ["review", "deleteComment"], mutation: true },
    // Group id mounts the per-group Acknowledge control; empty roster = un-acked.
    { path: ["review", "acknowledgements"], queryByInput: () => [] },
    { path: ["review", "acknowledge"], mutation: true },
    { path: ["archive", "list"] },
    { path: ["archive", "archiveReport"], mutation: true },
    { path: ["archive", "unarchiveReport"], mutation: true },
    { path: ["reports", "myHistory"] },
    { path: ["reports", "getActive"] },
    { path: ["leadForm", "byPeriod"] },
    { path: ["leadForm", "versions"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <SessionContext.Provider
          value={{
            user: {
              id: "head-user-id",
              name: "Test User",
              email: "test.user@example.com",
              role,
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }

  const renderResult = render(
    <WeeklyReportPage
      authorId={authorId}
      scope={scope}
      documentActionsLeading={documentActionsLeading}
      contextControls={contextControls}
      contextControlsLeading={contextControlsLeading}
    />,
    { wrapper: Wrapper },
  );

  return { ...renderResult, captured };
}

// Submitted|All filters the rendered accordion only; header/portfolio/nav stay
// on full truth. Default submitted-only for access-holders on a live period.
const AUTHOR_ID_B = "11111111-1111-4111-8111-bbbbbbbbbbbb";

function submittedSection() {
  return {
    reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_A,
    authorName: "Alice",
    status: "submitted" as const,
    submittedAt: new Date("2026-04-14T09:00:00Z"),
    projects: [{ projectId: PRODUCT_ID_A, projectName: "Product Alpha" }],
    items: [
      {
        id: "33333333-3333-4333-8333-aaaaaaaaaa01",
        projectId: PRODUCT_ID_A,
        type: "current" as const,
        text: "Alice submitted work",
        tag: "Dev",
        workflowStatus: "done" as const,
        carriedOver: false,
        completed: true,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
    priorities: [] as never[],
  };
}

function draftSection() {
  return {
    reportSectionId: "44444444-4444-4444-8444-bbbbbbbbbbb1",
    reportId: REPORT_ID,
    authorId: AUTHOR_ID_B,
    authorName: "Bob",
    status: "draft" as const,
    submittedAt: null,
    projects: [{ projectId: PRODUCT_ID_B, projectName: "Product Beta" }],
    items: [
      {
        id: "55555555-5555-4555-8555-bbbbbbbbbbb1",
        projectId: PRODUCT_ID_B,
        type: "current" as const,
        text: "Bob draft work",
        tag: "Dev",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
        completed: false,
      },
    ],
    risks: [] as never[],
    decisions: [] as never[],
    priorities: [] as never[],
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
    renderPage(
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

  it("overview navigation reveals and opens a product hidden by submitted-only", async () => {
    renderPage(
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

  it("all-draft live period shows the 'N in draft — Show all' signal, not the empty-state", async () => {
    renderPage({
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
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
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
    renderPage({
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
            priorities: [],
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
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();
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
    renderPage({
      ...makeWeeklyReportData("open", {
        portfolioOverview: [],
        leadSections: [],
      }),
      submissionCount: 0,
    });

    expect(
      await screen.findByTestId("empty-submissions-state"),
    ).toBeInTheDocument();
    // No draft is hidden and the toggle lives in the (unrendered) body branch.
    expect(screen.queryByTestId("draft-hidden-signal")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
  });

  it("published snapshot renders unfiltered with no filter toggle", async () => {
    renderPage(
      makeWeeklyReportData("published", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
      undefined,
      "head",
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
    renderPage(
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
    // A submitted section whose ONLY content is a touched activity must still
    // be publishable — hasAnyContent folds in activity content, not just
    // product content.
    renderPage({
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
            priorities: [],
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
    expect(
      screen.queryByTestId("empty-submissions-state"),
    ).not.toBeInTheDocument();

    // The submitted activity renders under the default submitted-only view.
    expect(
      await screen.findByTestId("activity-status-strip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jira triage duty")).toBeInTheDocument();

    // Publish is unblocked: submitted > 0 AND hasAnyContent (activity content).
    const publish = screen.getByRole("button", { name: /publish & lock/i });
    expect(publish).not.toBeDisabled();
  });

  it("activity-first-class: a seeded-but-untouched green activity does NOT defeat the empty-state", async () => {
    // Guards the touched-vs-seeded distinction: seedActivityStatuses defaults an
    // attached activity to status "green" (never null) on section create, so a
    // lead who only logged in — green activity, no note, no records, no product
    // content — is still an empty period. It must read "No submissions yet", not
    // render a scaffold of seeded-green activity cards.
    renderPage({
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
            priorities: [],
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

    expect(
      await screen.findByTestId("empty-submissions-state"),
    ).toBeInTheDocument();
  });

  it("does not offer the filter to a lead on a live period", async () => {
    renderPage(
      makeWeeklyReportData("open", {
        portfolioOverview: TWO_PRODUCT_OVERVIEW,
        leadSections: [submittedSection(), draftSection()],
      }),
      undefined,
      "lead",
    );

    await waitForReadyPage();
    expect(
      screen.queryByRole("group", { name: "Section filter" }),
    ).not.toBeInTheDocument();
    // A lead sees content unfiltered (no submitted-only narrowing).
    expect(accordionCard(PRODUCT_ID_B)).not.toBeNull();
  });
});
