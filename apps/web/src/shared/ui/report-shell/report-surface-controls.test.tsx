// @vitest-environment jsdom
// Pin control placement across on-screen versus print surfaces and preserve
// the inert aria-disabled contract.

import "@testing-library/jest-dom/vitest";

import type { Role } from "@customreport/shared";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PrintRouteContext } from "../../../features/pdf-export/server";
import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";

/* ---- Module mocks (must be hoisted above all imports of the SUT) ---- */

// Present routes permanently redirect to slides mode, while the print gate
// uses role-dependent temporary redirects. The mocks throw like Next does so
// redirect calls remain observable and rendering stops at the same boundary.
const permanentRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
});
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
// ViewerReportShell uses navigation hooks for URL-backed controls; stable
// stubs let the real shell mount in jsdom.
vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => permanentRedirect(url),
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reports/test-report-001",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../lib/auth/session-provider", () => ({
  useSession: () => ({ user: { role: "viewer" } }),
}));

// The /print server gate reads the cookie once via this helper; mock it
// per-test to drive the worker / human / no-session branches.
const getPrintRouteContext = vi.fn<() => Promise<PrintRouteContext>>();
vi.mock("../../../features/pdf-export/server", () => ({
  getPrintRouteContext: () => getPrintRouteContext(),
}));

vi.mock(
  "../../../features/report-pages/ui/lead/shell/lead-section-preview-auth",
  () => ({
    LeadSectionPreviewAuth: () => (
      <div data-testid="lead-section-preview-auth-stub" />
    ),
  }),
);

vi.mock("../../../features/report-pages/ui/weekly/weekly-report-page", () => ({
  // Render the context-controls slot so viewer controls remain observable in
  // the surface audit.
  WeeklyReportPage: ({ contextControls }: { contextControls?: ReactNode }) => (
    <div data-testid="weekly-report-page-stub">
      <h1>Status Report</h1>
      <div data-testid="weekly-report-context-controls">{contextControls}</div>
    </div>
  ),
}));

vi.mock(
  "../../../features/report-pages/ui/weekly/weekly-report-skeleton",
  () => ({
    WeeklyReportSkeleton: () => (
      <div data-testid="weekly-report-skeleton-stub" />
    ),
  }),
);

// RoleGate: pass children straight through for the lead preview test.
vi.mock("../auth-runtime/role-gate", () => ({
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
    useQuery: vi.fn((opts: { queryKey?: unknown[] }) => {
      if (
        opts.queryKey?.[0] === "weeklyReport.get" ||
        opts.queryKey?.[0] === "pdfExport.render"
      ) {
        return {
          data: makeWeeklyReportFixture({
            reportId: "test-report-001",
            periodStart: new Date("2026-06-08T00:00:00.000Z"),
            periodEnd: new Date("2026-06-14T00:00:00.000Z"),
            periodState: "published",
            periodStatus: "published",
          }),
          isLoading: false,
          isError: false,
          error: null,
        };
      }
      return {
        data: { status: "open" },
        isLoading: false,
        isError: false,
        error: null,
      };
    }),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("../../lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
    weeklyReport: {
      get: {
        queryOptions: (input?: { reportId?: string }) => ({
          queryKey: ["weeklyReport.get", input?.reportId ?? null],
        }),
      },
    },
    pdfExport: {
      request: { mutationOptions: () => ({}) },
      status: { queryOptions: () => ({ queryKey: ["pdfExport.status"] }) },
      render: {
        queryOptions: (input: { jobId: string; reportId: string }) => ({
          queryKey: ["pdfExport.render", input.jobId, input.reportId],
        }),
      },
    },
  }),
}));

vi.mock("../../../features/report-sections", () => ({
  STAGE_CHIP_BOX_HEIGHT: "36px",
  STATUS_BADGE: {
    "in-progress": { label: "In Progress" },
    completed: { label: "Completed" },
    blocked: { label: "Blocked" },
    "at-risk": { label: "At Risk" },
    planned: { label: "Planned" },
    paused: { label: "Paused" },
    postponed: { label: "Postponed" },
  },
  toNavigationPeriod: (args: {
    id: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    archived: boolean;
    isCurrent: boolean;
  }) => ({
    ...args,
    periodStart:
      args.periodStart instanceof Date
        ? args.periodStart
        : new Date(args.periodStart),
    weekLabel: "W1",
    dateRange: "Jun 1 – Jun 7",
  }),
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

/* ---- Imports under test (after all vi.mock registrations) ---- */

import PublishedReportPage from "../../../app/(app)/reports/[reportId]/page";
import PrintReportPage from "../../../app/print/[reportId]/page";

/* ---- Helpers ---- */

function paramsOf(reportId: string): Promise<{ reportId: string }> {
  // Both route components await this real Promise, matching their Props contract.
  return Promise.resolve({ reportId });
}

function searchParamsOf(authorId?: string): Promise<{ authorId?: string }> {
  return Promise.resolve(authorId === undefined ? {} : { authorId });
}

function sessionOf(role: Role): PrintRouteContext["session"] {
  return {
    userId: "44444444-4444-4444-8444-444444444444",
    email: `${role}@test.local`,
    name: `${role} user`,
    role,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

const TEST_REPORT_ID = "test-report-001";

/* ---- Published viewer ---- */

// WeeklyReportPage owns the title, while the wrapper routes actions through
// the context-controls slot; this keeps a single heading on screen.
describe("PublishedReportPage — single title + header actions", () => {
  it("renders exactly one Status Report title and no wrapper-level Report-ID", async () => {
    const ui = (await PublishedReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: searchParamsOf(),
    })) as ReactElement;
    render(ui);
    expect(
      screen.getAllByRole("heading", { name: "Status Report" }),
    ).toHaveLength(1);
    expect(screen.queryByText(/report id:/i)).not.toBeInTheDocument();
  });

  it("routes the viewer actions through the context controls slot", async () => {
    const ui = (await PublishedReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: searchParamsOf(),
    })) as ReactElement;
    render(ui);
    expect(screen.queryByTestId("report-actions-pill")).not.toBeInTheDocument();
    const contextControls = screen.getByTestId(
      "weekly-report-context-controls",
    );
    // The context toolbar has no archive link in the current report surface.
    expect(
      within(contextControls).queryByRole("link", {
        name: /back to archive/i,
      }),
    ).not.toBeInTheDocument();
  });

  // Presentation is selected through slides mode and PDF export is the only
  // print surface exposed by the viewer toolbar.
  it("renders no standalone Present or browser-Print links", async () => {
    const ui = (await PublishedReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: searchParamsOf(),
    })) as ReactElement;
    render(ui);
    expect(
      screen.queryByRole("link", { name: /presentation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /print/i }),
    ).not.toBeInTheDocument();
  });
});

/* ---- Print route — server gate: worker renders, human/no-session redirect ---- */

describe("PrintReportPage — PDF-worker-vs-human server gate", () => {
  it("renders the print template for the PDF worker bound to this report", async () => {
    permanentRedirect.mockClear();
    redirect.mockClear();
    // A real PDF-worker token rebuilds the requester's NON-null session
    // (trpc.context.ts:246-256), so the worker case carries session +
    // isPdfExport. This gives the test teeth: if the gate checked the
    // session branch before the worker-render check, the head session would
    // 308-redirect instead of rendering — the assertions below would fail.
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("head"),
      isPdfExport: true,
      pdfReportId: TEST_REPORT_ID,
      pdfJobId: "job-123",
    });
    const ui = (await PrintReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: Promise.resolve({ jobId: "job-123" }),
    })) as ReactElement;
    render(ui);
    // The template renders the report header.
    expect(
      screen.getByText(/core development — status report/i),
    ).toBeInTheDocument();
    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does NOT render the template when the worker token is bound to a different report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("head"),
      isPdfExport: true,
      pdfReportId: "some-other-report",
      pdfJobId: "job-123",
    });
    await expect(
      PrintReportPage({
        params: paramsOf(TEST_REPORT_ID),
        searchParams: Promise.resolve({ jobId: "job-123" }),
      }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  // Human redirects are TEMPORARY (307): the destination depends on the caller's
  // session role, so a permanent (308) redirect could be cached cross-role.
  it("307-redirects an authenticated head to the consolidated report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("head"),
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
    await expect(
      PrintReportPage({
        params: paramsOf(TEST_REPORT_ID),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:/head/report/${TEST_REPORT_ID}`);
  });

  it("307-redirects an authenticated viewer to the published report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("viewer"),
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
    await expect(
      PrintReportPage({
        params: paramsOf(TEST_REPORT_ID),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:/reports/${TEST_REPORT_ID}`);
  });

  it("307-redirects an authenticated lead to their own report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("lead"),
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
    await expect(
      PrintReportPage({
        params: paramsOf(TEST_REPORT_ID),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/lead/report");
  });

  it("307-redirects a no-session request to login with ?next", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
      pdfJobId: null,
    });
    const nextParam = encodeURIComponent(`/print/${TEST_REPORT_ID}`);
    await expect(
      PrintReportPage({
        params: paramsOf(TEST_REPORT_ID),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:/?next=${nextParam}`);
  });
});
