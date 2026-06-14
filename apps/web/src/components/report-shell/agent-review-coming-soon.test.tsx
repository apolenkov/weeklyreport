/**
 * @vitest-environment jsdom
 *
 * Tasks 3.1–3.3: verify AgentReviewComingSoon is mounted on every on-screen
 * report surface added by the mount-agent-review-placeholder change, that the
 * print page carries zero such controls, and that every mounted control keeps
 * aria-disabled="true" and the expected English copy.
 */

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/* ---- Module mocks (must be hoisted above all imports of the SUT) ---- */

// Heavy client components — stub to avoid hooks / tRPC context requirements.
vi.mock("../../components/head/head-present-client", () => ({
  HeadPresentClient: () => <div data-testid="head-present-client-stub" />,
}));

vi.mock("../../components/lead/lead-section-preview-auth", () => ({
  LeadSectionPreviewAuth: () => (
    <div data-testid="lead-section-preview-auth-stub" />
  ),
}));

vi.mock("../../components/weekly-report/weekly-report-page", () => ({
  // unify-top-action-toolbars D4: the viewer routes its action controls
  // (incl. the agent-review placeholder) through the `toolbar` slot, mirroring
  // the head report shell. Render the slot so the viewer's single placeholder
  // is observable in these tests.
  WeeklyReportPage: ({ toolbar }: { toolbar?: ReactNode }) => (
    <div data-testid="weekly-report-page-stub">{toolbar}</div>
  ),
}));

vi.mock("../../components/weekly-report/weekly-report-skeleton", () => ({
  WeeklyReportSkeleton: () => <div data-testid="weekly-report-skeleton-stub" />,
}));

// RoleGate: pass children straight through for the lead preview test.
vi.mock("../../components/role-gate", () => ({
  RoleGate: ({ children }: { children: ReactElement }) => children,
}));

// next/link renders as a plain <a> in jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

// react-query and tRPC stubs used by the print page.
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { status: "open" },
      isLoading: false,
      isError: false,
      error: null,
    })),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    weeklyReport: {
      get: { queryOptions: () => ({ queryKey: ["weeklyReport.get"] }) },
    },
  }),
}));

vi.mock("../../lib/mappers", () => ({
  mapWeeklyReport: () => ({
    portfolio: [],
    products: [],
    submissionCount: 0,
    totalLeads: 0,
    period: {
      id: "p1",
      reportId: "r1",
      periodStatus: "open" as const,
      weekLabel: "W1",
      dateRange: "Jun 1 – Jun 7",
      isCurrent: true,
    },
  }),
}));

// React.use() stub — resolves Promise params synchronously for client pages.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: <T,>(v: T): T => v };
});

/* ---- Imports under test (after all vi.mock registrations) ---- */

import HeadReportPresentPage from "../../app/(app)/head/report/[reportId]/present/page";
import LeadReportPreviewPage from "../../app/(app)/lead/report/[reportId]/preview/page";
import PublishedReportPage from "../../app/(app)/reports/[reportId]/page";
import PublishedReportPresentPage from "../../app/(app)/reports/[reportId]/present/page";
import PrintReportPage from "../../app/print/[reportId]/page";

/* ---- Helpers ---- */

function paramsOf(reportId: string): Promise<{ reportId: string }> {
  // Passed as a plain object; React.use() is stubbed to return it as-is.
  // Async server component pages use `await params` which also resolves fine
  // with a real Promise.
  return Promise.resolve({ reportId });
}

function searchParamsOf(authorId?: string): Promise<{ authorId?: string }> {
  return Promise.resolve({ authorId });
}

const TEST_REPORT_ID = "test-report-001";

/* ---- Published viewer ---- */

describe("PublishedReportPage — agent-review placeholder", () => {
  it("renders exactly one agent-review-coming-soon control", () => {
    render(
      <PublishedReportPage
        params={paramsOf(TEST_REPORT_ID)}
        searchParams={searchParamsOf()}
      />,
    );
    const controls = screen.getAllByTestId("agent-review-coming-soon");
    expect(controls).toHaveLength(1);
  });

  it("control has aria-disabled='true'", () => {
    render(
      <PublishedReportPage
        params={paramsOf(TEST_REPORT_ID)}
        searchParams={searchParamsOf()}
      />,
    );
    const control = screen.getByTestId("agent-review-coming-soon");
    expect(control).toHaveAttribute("aria-disabled", "true");
  });

  it("control carries the English copy 'Agent review'", () => {
    render(
      <PublishedReportPage
        params={paramsOf(TEST_REPORT_ID)}
        searchParams={searchParamsOf()}
      />,
    );
    expect(screen.getByText("Agent review")).toBeInTheDocument();
  });
});

// unify-top-action-toolbars task 2.0 / D4: the viewer used to render its OWN
// <h1>Status Report</h1> + Report-ID block ABOVE WeeklyReportPage, which
// renders the same title — doubling it on screen. The wrapper now owns NO title
// and routes its actions through the page's `toolbar` slot inside the shared
// ReportActionsPill, so the title shows exactly once.
describe("PublishedReportPage — single title + unified action pill (task 2.0)", () => {
  it("renders no wrapper-level title or Report-ID (WeeklyReportPage owns the title)", () => {
    render(
      <PublishedReportPage
        params={paramsOf(TEST_REPORT_ID)}
        searchParams={searchParamsOf()}
      />,
    );
    // The wrapper no longer emits a heading; the mocked page is a bare stub, so
    // zero headings here proves the duplicate <h1> is gone.
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText(/report id:/i)).not.toBeInTheDocument();
  });

  it("routes the viewer actions through the toolbar slot in one ReportActionsPill", () => {
    render(
      <PublishedReportPage
        params={paramsOf(TEST_REPORT_ID)}
        searchParams={searchParamsOf()}
      />,
    );
    const pill = screen.getByTestId("report-actions-pill");
    // Left group: Back to Archive (navigate away). Right group: presentation /
    // print / agent review (act on the current report).
    const back = within(pill).getByRole("link", { name: /back to archive/i });
    expect(back).toHaveAttribute("href", "/reports?tab=published");
    // The React.use() stub returns the params Promise as-is, so reportId is not
    // unwrapped here; assert the href SHAPE (route prefix/suffix) rather than
    // the interpolated id. The live-browser pass confirms the real id.
    expect(
      within(pill)
        .getByRole("link", { name: /open presentation/i })
        .getAttribute("href"),
    ).toMatch(/^\/reports\/.*\/present$/);
    expect(
      within(pill).getByRole("link", { name: /print/i }).getAttribute("href"),
    ).toMatch(/^\/print\//);
    expect(
      within(pill).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });
});

/* ---- Head presentation ---- */

describe("HeadReportPresentPage — agent-review placeholder", () => {
  it("renders exactly one agent-review-coming-soon control", async () => {
    const ui = (await HeadReportPresentPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    const controls = screen.getAllByTestId("agent-review-coming-soon");
    expect(controls).toHaveLength(1);
  });

  it("control has aria-disabled='true'", async () => {
    const ui = (await HeadReportPresentPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    expect(screen.getByTestId("agent-review-coming-soon")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("control carries the English copy 'Agent review'", async () => {
    const ui = (await HeadReportPresentPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    expect(screen.getByText("Agent review")).toBeInTheDocument();
  });
});

/* ---- Published presentation ---- */

describe("PublishedReportPresentPage — agent-review placeholder", () => {
  it("renders exactly one agent-review-coming-soon control", async () => {
    const ui = (await PublishedReportPresentPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    const controls = screen.getAllByTestId("agent-review-coming-soon");
    expect(controls).toHaveLength(1);
  });

  it("control has aria-disabled='true'", async () => {
    const ui = (await PublishedReportPresentPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    expect(screen.getByTestId("agent-review-coming-soon")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("control carries the English copy 'Agent review'", async () => {
    const ui = (await PublishedReportPresentPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    expect(screen.getByText("Agent review")).toBeInTheDocument();
  });
});

/* ---- Lead self-preview ---- */

describe("LeadReportPreviewPage — agent-review placeholder", () => {
  it("renders exactly one agent-review-coming-soon control", async () => {
    const ui = (await LeadReportPreviewPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    const controls = screen.getAllByTestId("agent-review-coming-soon");
    expect(controls).toHaveLength(1);
  });

  it("control has aria-disabled='true'", async () => {
    const ui = (await LeadReportPreviewPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    expect(screen.getByTestId("agent-review-coming-soon")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("control carries the English copy 'Agent review'", async () => {
    const ui = (await LeadReportPreviewPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    expect(screen.getByText("Agent review")).toBeInTheDocument();
  });
});

/* ---- Print page — must have zero controls (Task 3.2) ---- */

describe("PrintReportPage — no agent-review placeholder", () => {
  it("renders zero agent-review-coming-soon controls on the print surface", () => {
    render(<PrintReportPage params={paramsOf(TEST_REPORT_ID)} />);
    expect(screen.queryAllByTestId("agent-review-coming-soon")).toHaveLength(0);
  });
});
