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

import { logClientError } from "../../../../shared/lib/errors/client-error-reporting";
import { makeQueryState } from "../../../../test-utils/query-state";
import { HeadReportShell } from "./head-report-shell";
import {
  mockPathname,
  mockReplace,
  mockSearchParams,
  TEST_REPORT_ID,
} from "./head-report-shell.test-support";

describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 1", () => {
  const ACTIVE_VAR = "bg-[var(--color-toggle-active)]";
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("highlights the Edit segment as active in form mode", () => {
    mockPathname.mockReturnValue("/head/report");
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    const slides = screen.getByRole("link", { name: /slides/i });
    const edit = screen.getByRole("link", { name: /^report$/i });
    expect(edit.className).toContain(ACTIVE_VAR);
    expect(slides.className).not.toContain(ACTIVE_VAR);
  });
});
describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 2", () => {
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("restores scope from the URL and threads it into the toggle links", () => {
    mockPathname.mockReturnValue("/head/report");
    mockSearchParams.mockReturnValue(new URLSearchParams("scope=lead"));
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    // The Slides link preserves scope and flips mode; the Edit link preserves
    // scope and drops mode — so a shared link keeps the active scope.
    const slidesHref = screen
      .getByRole("link", { name: /slides/i })
      .getAttribute("href");
    expect(slidesHref).toContain("scope=lead");
    expect(slidesHref).toContain("mode=slides");
    const editHref = screen
      .getByRole("link", { name: /^report$/i })
      .getAttribute("href");
    expect(editHref).toContain("scope=lead");
    expect(editHref).not.toContain("mode=");
  });
});
describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 3", () => {
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("writes the show-archived filter to the URL via router.replace", async () => {
    const user = userEvent.setup();
    mockPathname.mockReturnValue("/head/report");
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    await user.click(screen.getByRole("switch", { name: /archive/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("archive=1"),
      expect.objectContaining({ scroll: false }),
    );
  });
});
describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 4", () => {
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("restores the show-archived filter from the URL on load", () => {
    // The spec's "refresh preserves the view state" scenario covers the archive
    // filter too: a shared `?archive=1` URL must restore the toggle as checked,
    // not just write it on click.
    mockPathname.mockReturnValue("/head/report");
    mockSearchParams.mockReturnValue(new URLSearchParams("archive=1"));
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="form" />);

    expect(screen.getByRole("switch", { name: /archive/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
describe("HeadReportShell active query failure policy — 5", () => {
  it("logs only the active transport failure and retains the addressed shell", () => {
    const error = new Error("active transport failed");
    vi.mocked(useQuery).mockImplementation((options) =>
      options.queryKey[0] === "weeklyReport.get" && options.queryKey[1] === null
        ? makeQueryState({ data: undefined, error })
        : makeQueryState({
            data:
              options.queryKey[0] === "weeklyReport.get"
                ? { status: "no-period" }
                : { entries: [] },
          }),
    );
    const rendered = render(
      <HeadReportShell reportId={TEST_REPORT_ID} mode="form" />,
    );
    expect(screen.getByTestId("weekly-report-page-stub")).toBeInTheDocument();
    expect(logClientError).toHaveBeenCalledWith(
      "headReport.active.load_failed",
      error,
      { component: "HeadReportShell", procedure: "weeklyReport.get" },
    );
    rendered.rerender(
      <HeadReportShell reportId={TEST_REPORT_ID} mode="form" />,
    );
    expect(logClientError).toHaveBeenCalledTimes(1);
  });
});
