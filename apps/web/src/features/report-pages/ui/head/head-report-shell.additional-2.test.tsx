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
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../../test-utils/query-state";
import { HeadReportShell } from "./head-report-shell";
import { mockPathname } from "./head-report-shell.test-support";
describe("HeadReportShell — period navigator shows addressed week — 9", () => {
  const ACTIVE_ID = "a0000000-0000-4000-8000-000000000001";
  const NEWER_ID = "a0000000-0000-4000-8000-000000000006";
  const NEWER_START = "2026-05-25T00:00:00.000Z";
  const NEWER_END = "2026-05-31T00:00:00.000Z";
  const OLDER_ID = "a0000000-0000-4000-8000-000000000005";
  const OLDER_START = "2026-05-18T00:00:00.000Z";
  const OLDER_END = "2026-05-24T00:00:00.000Z";
  const ACTIVE_START = "2026-06-08T00:00:00.000Z";
  const ACTIVE_END = "2026-06-14T00:00:00.000Z";
  function wireQueries() {
    const impl = (opts: Parameters<typeof useQuery>[0]) => {
      const key = opts.queryKey[0];
      if (key === "weeklyReport.get") {
        return makeQueryState({
          data: {
            status: "active",
            reportId: ACTIVE_ID,
            periodStart: ACTIVE_START,
            periodEnd: ACTIVE_END,
            periodStatus: "open",
          },
        });
      }
      return makeQueryState({
        data: {
          entries: [
            {
              reportId: NEWER_ID,
              periodStart: NEWER_START,
              periodEnd: NEWER_END,
              archived: false,
            },
            {
              reportId: OLDER_ID,
              periodStart: OLDER_START,
              periodEnd: OLDER_END,
              archived: false,
            },
          ],
        },
      });
    };
    vi.mocked(useQuery).mockImplementation(impl);
  }
  it("trigger shows the active week (not the latest published) on /head/report/<activeId>", () => {
    wireQueries();
    mockPathname.mockReturnValue(`/head/report/${ACTIVE_ID}`);

    render(<HeadReportShell reportId={ACTIVE_ID} mode="form" />);

    const trigger = screen.getByRole("combobox", {
      name: /select reporting period/i,
    });
    // Active week is Jun 8-14 (ISO week 24); the published week is May 25-31.
    expect(trigger).toHaveTextContent(/jun 8.*14/i);
    expect(trigger).not.toHaveTextContent(/may 25/i);
  });
});
