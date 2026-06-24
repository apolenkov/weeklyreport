/**
 * @vitest-environment jsdom
 *
 * viewer-report-surface-parity (task 5): the read-only viewer shell mirrors the
 * head shell's toolbar primitives (ScopeToggle, ViewModeToggle, Export-PDF,
 * period nav, Back-to-Archive) but renders NO mutation affordance, and its URLs
 * target `/reports/...`, not `/head/report/...`.
 */

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../slides/head-slides-client", () => ({
  HeadSlidesClient: (props: { enableActivity?: boolean }) => (
    <div
      data-testid="slides-client-stub"
      data-enable-activity={String(props.enableActivity)}
    />
  ),
}));

vi.mock("../weekly-report/weekly-report-page", () => ({
  WeeklyReportPage: ({
    documentActionsLeading,
    contextControls,
  }: {
    documentActionsLeading?: React.ReactNode;
    contextControls?: React.ReactNode;
  }) => (
    <div data-testid="weekly-report-page-stub">
      <header>
        <h1>Status Report</h1>
      </header>
      <div data-testid="report-toolbar">
        <div role="group" aria-label="Document actions">
          {documentActionsLeading}
        </div>
        <div role="group" aria-label="Context controls">
          {contextControls}
        </div>
      </div>
    </div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

const mockPathname = vi.fn(() => "/reports/test-report-001");
const mockSearchParams = vi.fn(() => new URLSearchParams());
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
  usePathname: () => mockPathname(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn((opts: { queryKey?: unknown[] }) => {
      const key = opts.queryKey?.[0];
      if (key === "weeklyReport.get") {
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
      return { data: { entries: [] }, isLoading: false, isError: false };
    }),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock("../../lib/trpc-context", () => ({
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

import { ViewerReportShell } from "./viewer-report-shell";

const REPORT_ID = "test-report-001";

afterEach(() => {
  mockSearchParams.mockReturnValue(new URLSearchParams());
  mockReplace.mockReset();
  vi.mocked(useQuery).mockClear();
});

describe("ViewerReportShell — read-only toolbar parity", () => {
  it("form mode renders the scope toggle, view-mode toggle, and Back-to-Archive in the context controls", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);

    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(within(contextControls).getByRole("radiogroup")).toBeInTheDocument();
    expect(
      within(contextControls).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    expect(
      within(contextControls).getByRole("link", { name: /back to archive/i }),
    ).toBeInTheDocument();
    expect(
      within(contextControls).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });

  it("renders exactly one Export-PDF, in the document-action row (viewer gets the real export)", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const exportButtons = screen.getAllByRole("button", {
      name: /export pdf/i,
    });
    expect(exportButtons).toHaveLength(1);
    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(
      within(documentActions).getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
  });

  it("renders NO mutation affordance (no Publish / Lock / Reopen)", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    expect(
      screen.queryByRole("button", { name: /publish|lock|reopen/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("head-publish-lock-action-stub"),
    ).not.toBeInTheDocument();
  });

  it("view-mode toggle links target /reports/, never /head/report", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).toContain(`/reports/${REPORT_ID}`);
    expect(slidesHref).toContain("mode=slides");
    expect(slidesHref).not.toContain("/head/report");
  });

  it("threads the URL scope into the toggle links", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("scope=lead"));
    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />);
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).toContain("scope=lead");
  });

  it("slides mode renders the deck with activity disabled (head-only procedure)", () => {
    render(<ViewerReportShell reportId={REPORT_ID} mode="slides" />);
    const deck = screen.getByTestId("slides-client-stub");
    expect(deck).toBeInTheDocument();
    expect(deck).toHaveAttribute("data-enable-activity", "false");
    // Still no mutation affordance on the slides surface.
    expect(
      screen.queryByRole("button", { name: /publish|lock|reopen/i }),
    ).not.toBeInTheDocument();
  });
});
