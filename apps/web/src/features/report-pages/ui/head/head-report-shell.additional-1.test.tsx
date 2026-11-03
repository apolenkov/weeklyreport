import {
  mockReplace,
  mockSearchParams,
} from "./head-report-shell.test-support";
vi.mock("../../../slides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../slides")>();
  return {
    ...actual,
    HeadSlidesClient: () => <div data-testid="head-slides-client-stub" />,
  };
});
vi.mock("../../../period", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../period")>();
  return {
    ...actual,
    HeadPublishLockAction: () => (
      <div data-testid="head-publish-lock-action-stub" />
    ),
  };
});
vi.mock("../weekly/weekly-report-page", () => ({
  // Synthesize header + Document/Context toolbar groups so routing is pinable.
  WeeklyReportPage: ({
    documentActionsLeading,
    contextControls,
    headerContextLabel,
    reviewIntent,
    authorId,
  }: {
    documentActionsLeading?: React.ReactNode;
    contextControls?: React.ReactNode;
    headerContextLabel?: React.ReactNode;
    reviewIntent?: boolean;
    authorId?: string;
  }) => (
    <div
      data-testid="weekly-report-page-stub"
      data-review-intent={String(reviewIntent)}
      data-author-id={authorId}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]">
        <h1>Status Report</h1>
        <div data-testid="weekly-report-header-label">{headerContextLabel}</div>
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
  // Forward className + title so the active-segment styling on ViewModeToggle is
  // observable; drop Next-only props (scroll) that <a> would reject.
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
        return makeQueryState({ data: { status: "no-period" } });
      }
      return makeQueryState({ data: { entries: [] } });
    }),
    // ExportPdfButton (rendered in the shell toolbar trailing group) calls
    // useMutation for pdfExport.request. Stub it so the shell mounts without a
    // QueryClientProvider; these tests do not exercise export behavior.
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});
vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      compiledHistory: {
        queryOptions: () => ({ queryKey: ["reports.compiledHistory"] }),
      },
    },
    weeklyReport: {
      get: {
        // Encode reportId so DISPLAYED (`{ reportId }`) and ACTIVE (`{}` → null) differ.
        queryOptions: (input?: { reportId?: string }) => ({
          queryKey: ["weeklyReport.get", input?.reportId ?? null],
        }),
      },
    },
    // ExportPdfButton calls these on render; stub so the shell mounts cleanly.
    pdfExport: {
      request: { mutationOptions: () => ({}) },
      status: {
        queryOptions: () => ({ queryKey: ["pdfExport.status"] }),
      },
    },
  }),
}));
vi.mock(
  "../../../../shared/lib/errors/client-error-reporting",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../shared/lib/errors/client-error-reporting")
    >()),
    logClientError: vi.fn(),
  }),
);
// @vitest-environment jsdom
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../../test-utils/query-state";
import { HeadReportShell } from "./head-report-shell";
import { mockPathname, TEST_REPORT_ID } from "./head-report-shell.test-support";
describe("HeadReportShell — context control cluster — 6", () => {
  function wireActivePeriod() {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: TEST_REPORT_ID,
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({ data: { entries: [] } });
    };
    vi.mocked(useQuery).mockImplementation(impl);
  }
  it("renders exactly one labeled Export-PDF in the document-action row", () => {
    wireActivePeriod();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);
    const exportButtons = screen.getAllByRole("button", {
      name: /export pdf/i,
    });
    expect(exportButtons).toHaveLength(1);
    // The single Export-PDF is a document action, not a context control.
    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(
      within(documentActions).getByRole("button", { name: /export pdf/i }),
    ).toBeInTheDocument();
    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(
      within(contextControls).queryByRole("button", { name: /export pdf/i }),
    ).not.toBeInTheDocument();
  });
});
describe("HeadReportShell — context control cluster — 7", () => {
  function wireActivePeriod() {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: TEST_REPORT_ID,
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({ data: { entries: [] } });
    };
    vi.mocked(useQuery).mockImplementation(impl);
  }
  it("slides mode keeps the toggles", () => {
    wireActivePeriod();
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);
    expect(screen.queryByTestId("report-actions-pill")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /slides/i })).toBeInTheDocument();
  });
});
describe("HeadReportShell — context control cluster — 8", () => {
  it("surfaces a history-query failure instead of silently truncating period navigation", () => {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: TEST_REPORT_ID,
            periodStart: "2026-06-08T00:00:00.000Z",
            periodEnd: "2026-06-14T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({ data: undefined, error: new Error("boom") });
    };
    vi.mocked(useQuery).mockImplementation(impl);

    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    expect(screen.getByTestId("head-history-error")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Select reporting period" }),
    ).not.toBeInTheDocument();
  });
});
