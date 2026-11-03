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

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../../test-utils/query-state";
import { HeadReportShell } from "./head-report-shell";
import {
  mockPathname,
  mockReplace,
  mockSearchParams,
  TEST_REPORT_ID,
} from "./head-report-shell.test-support";
describe("HeadReportShell — view-mode toggle reflects mode + URL view state — 6", () => {
  const ACTIVE_VAR = "bg-[var(--color-toggle-active)]";
  afterEach(() => {
    // Reset the per-test URL override so later suites see an empty query.
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockReplace.mockReset();
  });
  it("highlights the Slides segment as active when mode is slides", () => {
    mockPathname.mockReturnValue("/head/report");
    render(<HeadReportShell reportId={TEST_REPORT_ID} mode="slides" />);

    const slides = screen.getByRole("link", { name: /slides/i });
    const edit = screen.getByRole("link", { name: /^report$/i });
    expect(slides.className).toContain(ACTIVE_VAR);
    expect(edit.className).not.toContain(ACTIVE_VAR);
  });
});
