/**
 * @vitest-environment jsdom
 *
 * Tasks 3.1–3.3: verify AgentReviewComingSoon is mounted on every on-screen
 * report surface added by the mount-agent-review-placeholder change, that the
 * print page carries zero such controls, and that every mounted control keeps
 * aria-disabled="true" and the expected English copy.
 */

import "@testing-library/jest-dom/vitest";

import type { Role } from "@customreport/shared";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PrintRouteContext } from "../../../lib/server/get-print-route-context";

/* ---- Module mocks (must be hoisted above all imports of the SUT) ---- */

// fix-report-surface-integrity W2 (task 3.3): the present routes now
// `permanentRedirect` to `?mode=slides` and the print route is a server gate
// that `permanentRedirect`s humans / `redirect`s no-session. Mock both so the
// SUT calls are observable; real Next throws to halt rendering, so the mocks
// throw a tagged error too (the SUT never renders past the redirect).
const permanentRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
});
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
// viewer-report-surface-parity: PublishedReportPage now renders the real
// ViewerReportShell, which uses the navigation hooks for its URL-backed scope /
// view-mode / archive toggles. Stub them so the shell mounts in jsdom.
vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => permanentRedirect(url),
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reports/test-report-001",
  useSearchParams: () => new URLSearchParams(),
}));

// The /print server gate reads the cookie once via this helper; mock it
// per-test to drive the worker / human / no-session branches.
const getPrintRouteContext = vi.fn<() => Promise<PrintRouteContext>>();
vi.mock("../../../lib/server/get-print-route-context", () => ({
  getPrintRouteContext: () => getPrintRouteContext(),
}));

vi.mock(
  "../../../features/report-sections/ui/lead-section-preview-auth",
  () => ({
    LeadSectionPreviewAuth: () => (
      <div data-testid="lead-section-preview-auth-stub" />
    ),
  }),
);

vi.mock("../../../features/report-sections/ui/weekly-report-page", () => ({
  // viewer-report-surface-parity: the viewer now wraps WeeklyReportPage in
  // ViewerReportShell, which routes the full bottom-row controls (agent-review
  // placeholder + Back-to-Archive + scope/view-mode toggles) through the
  // `contextControls` slot. Render that slot so the viewer's single placeholder
  // and Back-to-Archive link stay observable in these surface-audit tests.
  WeeklyReportPage: ({ contextControls }: { contextControls?: ReactNode }) => (
    <div data-testid="weekly-report-page-stub">
      <h1>Status Report</h1>
      <div data-testid="weekly-report-context-controls">{contextControls}</div>
    </div>
  ),
}));

vi.mock("../../../features/report-sections/ui/weekly-report-skeleton", () => ({
  WeeklyReportSkeleton: () => <div data-testid="weekly-report-skeleton-stub" />,
}));

// RoleGate: pass children straight through for the lead preview test.
vi.mock("../role-gate", () => ({
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
    // The viewer shell's displayed-period query needs a real published period so
    // its Export-PDF + period navigator render; every other surface keeps the
    // prior generic `{ status: "open" }` shape.
    useQuery: vi.fn((opts: { queryKey?: unknown[] }) => {
      if (opts.queryKey?.[0] === "weeklyReport.get") {
        return {
          data: {
            status: "active",
            reportId: "test-report-001",
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
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

vi.mock("../../../lib/trpc-context", () => ({
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
    },
  }),
}));

vi.mock("../../../features/report-sections/model/weekly-report", () => ({
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

import HeadReportPresentPage from "../../../app/(app)/head/report/[reportId]/present/page";
import LeadReportPreviewPage from "../../../app/(app)/lead/report/[reportId]/preview/page";
import PublishedReportPage from "../../../app/(app)/reports/[reportId]/page";
import PublishedReportPresentPage from "../../../app/(app)/reports/[reportId]/present/page";
import PrintReportPage from "../../../app/print/[reportId]/page";

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

describe("PublishedReportPage — agent-review placeholder", () => {
  it("renders exactly one agent-review-coming-soon control", async () => {
    const ui = (await PublishedReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: searchParamsOf(),
    })) as ReactElement;
    render(ui);
    const controls = screen.getAllByTestId("agent-review-coming-soon");
    expect(controls).toHaveLength(1);
  });

  it("control has aria-disabled='true'", async () => {
    const ui = (await PublishedReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: searchParamsOf(),
    })) as ReactElement;
    render(ui);
    const control = screen.getByTestId("agent-review-coming-soon");
    expect(control).toHaveAttribute("aria-disabled", "true");
  });

  it("control carries the English copy 'Agent review'", async () => {
    const ui = (await PublishedReportPage({
      params: paramsOf(TEST_REPORT_ID),
      searchParams: searchParamsOf(),
    })) as ReactElement;
    render(ui);
    expect(screen.getByText("Agent review")).toBeInTheDocument();
  });
});

// unify-top-action-toolbars task 2.0 / D4: the viewer used to render its OWN
// <h1>Status Report</h1> + Report-ID block ABOVE WeeklyReportPage, which
// renders the same title — doubling it on screen. The wrapper now owns NO title
// and routes its actions through the page's `contextControlsLeading` slot, so
// the title shows exactly once.
describe("PublishedReportPage — single title + header actions (task 2.0)", () => {
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
    // viewer-live-status (task 5.1): Back-to-Archive is removed; the Agent-review
    // coming-soon control stays (deferred-feature-pattern contract).
    expect(
      within(contextControls).queryByRole("link", {
        name: /back to archive/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(contextControls).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });

  // fix-report-surface-integrity W2 (task 3.3, report-toolbar-parity): the
  // standalone Present and browser-Print links are GONE from the viewer
  // toolbar. Presentation is reached via `?mode=slides`; the only export is
  // the single labeled Export-PDF rendered by WeeklyReportPage's trailing
  // group (the now-broken `/print` deep link is removed — the print route
  // 308-redirects humans away).
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

/* ---- Present routes — now 308-redirect to slides mode (W2 task 3.3) ---- */

describe("HeadReportPresentPage — 308 redirect to slides", () => {
  it("permanentRedirects to /head/report/[id]?mode=slides", async () => {
    permanentRedirect.mockClear();
    await expect(
      HeadReportPresentPage({ params: paramsOf(TEST_REPORT_ID) }),
    ).rejects.toThrow(
      `NEXT_PERMANENT_REDIRECT:/head/report/${TEST_REPORT_ID}?mode=slides`,
    );
    expect(permanentRedirect).toHaveBeenCalledWith(
      `/head/report/${TEST_REPORT_ID}?mode=slides`,
    );
  });
});

describe("PublishedReportPresentPage — 308 redirect to slides", () => {
  it("permanentRedirects to /reports/[id]?mode=slides", async () => {
    permanentRedirect.mockClear();
    await expect(
      PublishedReportPresentPage({ params: paramsOf(TEST_REPORT_ID) }),
    ).rejects.toThrow(
      `NEXT_PERMANENT_REDIRECT:/reports/${TEST_REPORT_ID}?mode=slides`,
    );
    expect(permanentRedirect).toHaveBeenCalledWith(
      `/reports/${TEST_REPORT_ID}?mode=slides`,
    );
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

/* ---- Print route — server gate: worker renders, human/no-session redirect ---- */

describe("PrintReportPage — PDF-worker-vs-human server gate (W2 task 3.3)", () => {
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
    });
    const ui = (await PrintReportPage({
      params: paramsOf(TEST_REPORT_ID),
    })) as ReactElement;
    render(ui);
    // The template renders the report header — and zero agent-review controls.
    expect(
      screen.getByText(/Software Development — status report/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId("agent-review-coming-soon")).toHaveLength(0);
    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does NOT render the template when the worker token is bound to a different report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("head"),
      isPdfExport: true,
      pdfReportId: "some-other-report",
    });
    await expect(
      PrintReportPage({ params: paramsOf(TEST_REPORT_ID) }),
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
    });
    await expect(
      PrintReportPage({ params: paramsOf(TEST_REPORT_ID) }),
    ).rejects.toThrow(`NEXT_REDIRECT:/head/report/${TEST_REPORT_ID}`);
  });

  it("307-redirects an authenticated viewer to the published report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("viewer"),
      isPdfExport: false,
      pdfReportId: null,
    });
    await expect(
      PrintReportPage({ params: paramsOf(TEST_REPORT_ID) }),
    ).rejects.toThrow(`NEXT_REDIRECT:/reports/${TEST_REPORT_ID}`);
  });

  it("307-redirects an authenticated lead to their own report", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: sessionOf("lead"),
      isPdfExport: false,
      pdfReportId: null,
    });
    await expect(
      PrintReportPage({ params: paramsOf(TEST_REPORT_ID) }),
    ).rejects.toThrow("NEXT_REDIRECT:/lead/report");
  });

  it("307-redirects a no-session request to login with ?next", async () => {
    redirect.mockClear();
    getPrintRouteContext.mockResolvedValue({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
    });
    const nextParam = encodeURIComponent(`/print/${TEST_REPORT_ID}`);
    await expect(
      PrintReportPage({ params: paramsOf(TEST_REPORT_ID) }),
    ).rejects.toThrow(`NEXT_REDIRECT:/?next=${nextParam}`);
  });
});
