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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../../test-utils/query-state";
import { HeadReportShell } from "./head-report-shell";
import {
  mockPathname,
  mockReplace,
  mockSearchParams,
  TEST_REPORT_ID,
} from "./head-report-shell.test-support";
describe("HeadReportShell — active week reachable from a published week — 3", () => {
  const ACTIVE_ID = "a0000000-0000-4000-8000-000000000001";
  const PUBLISHED_ID = "a0000000-0000-4000-8000-000000000005";
  function wirePublishedView() {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        const requestedReportId = opts.queryKey[1];
        if (requestedReportId === null) {
          return makeQueryState({
            data: {
              status: "active",
              reportId: ACTIVE_ID,
              periodStart: "2026-06-08T00:00:00.000Z",
              periodEnd: "2026-06-14T00:00:00.000Z",
              periodStatus: "open",
            },
          });
        }
        return makeQueryState({
          data: {
            status: "active",
            reportId: PUBLISHED_ID,
            periodStart: "2026-05-18T00:00:00.000Z",
            periodEnd: "2026-05-24T00:00:00.000Z",
            periodStatus: "published",
          },
        });
      }
      return makeQueryState({
        data: {
          entries: [
            {
              reportId: PUBLISHED_ID,
              periodStart: "2026-05-18T00:00:00.000Z",
              periodEnd: "2026-05-24T00:00:00.000Z",
              archived: false,
            },
          ],
        },
      });
    };
    vi.mocked(useQuery).mockImplementation(impl);
  }
  it("offers the current week as an option while viewing a published week", async () => {
    const user = userEvent.setup();
    wirePublishedView();
    mockPathname.mockReturnValue(`/head/report/${PUBLISHED_ID}`);

    render(<HeadReportShell reportId={PUBLISHED_ID} mode="form" />);

    // Trigger resolves to the displayed published week (May 18-24).
    const trigger = screen.getByRole("combobox", {
      name: /select reporting period/i,
    });
    expect(trigger).toHaveTextContent(/may 18.*24/i);

    // Listbox must expose the current week; without active-prepend it is absent.
    await user.click(trigger);
    const options = screen.getAllByRole("option");
    expect(options.some((o) => /jun 8.*14/i.test(o.textContent))).toBe(true);
  });
});
describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 4", () => {
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("threads current URL review intent and author, including history back to Read", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("scope=lead&review=1&authorId=alice"),
    );
    const view = render(
      <HeadReportShell
        reportId={TEST_REPORT_ID}
        mode="form"
        authorId="alice"
        reviewIntent
      />,
    );
    expect(screen.getByTestId("weekly-report-page-stub")).toHaveAttribute(
      "data-review-intent",
      "true",
    );
    expect(screen.getByTestId("weekly-report-page-stub")).toHaveAttribute(
      "data-author-id",
      "alice",
    );
    const slides = new URL(
      screen.getByRole("link", { name: /slides/i }).getAttribute("href") ?? "",
      "http://localhost",
    );
    expect(slides.searchParams.get("review")).toBe("1");
    expect(slides.searchParams.get("authorId")).toBe("alice");
    mockSearchParams.mockReturnValue(
      new URLSearchParams("scope=lead&authorId=alice"),
    );
    view.rerender(
      <HeadReportShell
        reportId={TEST_REPORT_ID}
        mode="form"
        authorId="alice"
        reviewIntent
      />,
    );
    expect(screen.getByTestId("weekly-report-page-stub")).toHaveAttribute(
      "data-review-intent",
      "false",
    );
  });
});
describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 5", () => {
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("preserves review intent in Slides links without mounting review content", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("review=1&scope=lead"),
    );
    render(
      <HeadReportShell reportId={TEST_REPORT_ID} mode="slides" reviewIntent />,
    );
    expect(
      screen.queryByTestId("weekly-report-page-stub"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("head-slides-client-stub")).toBeInTheDocument();
    const report = screen.getByRole("link", { name: /^report$/i });
    expect(report).toHaveAttribute("href", expect.stringContaining("review=1"));
  });
});
