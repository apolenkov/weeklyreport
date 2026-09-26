// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SessionContext,
  type SessionState,
} from "../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const { mockLogClientError, mockReplace, mockSearchParams } = vi.hoisted(
  () => ({
    mockLogClientError: vi.fn(),
    mockReplace: vi.fn(),
    mockSearchParams: vi.fn<() => URLSearchParams>(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  usePathname: () => "/reports/report-a",
  useSearchParams: () => mockSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../../pdf-export", () => ({
  ExportPdfButton: ({ reportId }: { reportId: string }) => (
    <button type="button">Export {reportId}</button>
  ),
}));

vi.mock("../../../shared/lib/errors/client-error-reporting", async () => {
  const actual = await vi.importActual<
    typeof import("../../../shared/lib/errors/client-error-reporting")
  >("../../../shared/lib/errors/client-error-reporting");
  return { ...actual, logClientError: mockLogClientError };
});

import { ViewerReportShell } from "./viewer-report-shell";

const REPORT_ID = "report-a";
const REPORT_QUERY_KEY = [
  ["weeklyReport", "get"],
  { reportId: REPORT_ID },
] as const;

const VIEWER_SESSION: SessionState = {
  user: {
    id: "viewer-1",
    name: "Viewer",
    email: "viewer@example.com",
    role: "viewer",
  },
  organization: null,
  isLoading: false,
  isAuthenticated: true,
};

function makeNotFoundError(): TRPCClientError<never> {
  const error = new TRPCClientError<never>("Invalid report link.");
  Object.defineProperty(error, "data", {
    value: { code: "NOT_FOUND", httpStatus: 404 },
    configurable: true,
  });
  return error;
}

function makeReport(reportId: string) {
  return {
    status: "active" as const,
    reportId,
    periodStart: new Date("2026-07-06T00:00:00Z"),
    periodEnd: new Date("2026-07-12T00:00:00Z"),
    deadline: new Date("2026-07-10T15:00:00Z"),
    periodStatus: "open" as const,
    weekLabel: "Report A period",
    submissionCount: 0,
    totalLeads: 0,
    activeDeadlineReminderRuleId: null,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
  };
}

function makeHarness(error: TRPCClientError<never>) {
  let reportAttempts = 0;
  const { proxy } = createMockTRPC([
    { path: ["reports", "compiledHistory"], query: { entries: [] } },
    {
      path: ["weeklyReport", "get"],
      queryByInput: () => {
        reportAttempts += 1;
        if (reportAttempts === 1 || reportAttempts === 3) {
          return Promise.reject(error);
        }
        return makeReport(REPORT_ID);
      },
    },
    { path: ["activity", "live"], query: { reportId: REPORT_ID, rows: [] } },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    { path: ["archive", "archiveReport"], mutation: true },
    { path: ["archive", "unarchiveReport"], mutation: true },
  ]);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Providers = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={VIEWER_SESSION}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </SessionContext.Provider>
    </QueryClientProvider>
  );

  return { client, Providers };
}

beforeEach(() => {
  mockLogClientError.mockClear();
  mockReplace.mockClear();
  mockSearchParams.mockReset();
  mockSearchParams.mockReturnValue(new URLSearchParams());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ViewerReportShell query error reporting", () => {
  it.each(["form", "slides"] as const)(
    "%s mode logs once for each weeklyReport.get error transition",
    async (mode) => {
      const error = makeNotFoundError();
      const { client, Providers } = makeHarness(error);

      render(<ViewerReportShell reportId={REPORT_ID} mode={mode} />, {
        wrapper: Providers,
      });

      if (mode === "form") {
        expect(await screen.findByText(/report not found/i)).toBeVisible();
      } else {
        expect(await screen.findByText(/slides could not load/i)).toBeVisible();
      }

      expect(mockLogClientError).toHaveBeenCalledTimes(1);
      expect(mockLogClientError).toHaveBeenCalledWith(
        mode === "form"
          ? "weeklyReport.get.load_failed"
          : "headSlides.weeklyReport.load_failed",
        error,
        expect.objectContaining({ procedure: "weeklyReport.get" }),
      );

      const query = client
        .getQueryCache()
        .find({ queryKey: REPORT_QUERY_KEY, exact: true });
      expect(query).toBeDefined();

      await act(async () => {
        await client.refetchQueries({
          queryKey: REPORT_QUERY_KEY,
          exact: true,
        });
      });
      await waitFor(() => {
        expect(
          client.getQueryCache().find({
            queryKey: REPORT_QUERY_KEY,
            exact: true,
          })?.state.status,
        ).toBe("success");
      });
      expect(mockLogClientError).toHaveBeenCalledTimes(1);

      await act(async () => {
        await client.refetchQueries({
          queryKey: REPORT_QUERY_KEY,
          exact: true,
        });
      });
      await waitFor(() => {
        expect(mockLogClientError).toHaveBeenCalledTimes(2);
      });
      expect(mockLogClientError).toHaveBeenNthCalledWith(
        2,
        mode === "form"
          ? "weeklyReport.get.load_failed"
          : "headSlides.weeklyReport.load_failed",
        error,
        expect.objectContaining({ procedure: "weeklyReport.get" }),
      );
    },
  );

  it("logs the one-shot recovery failure while the child query surface is unmounted", async () => {
    const error = makeNotFoundError();
    const { Providers } = makeHarness(error);
    mockSearchParams.mockReturnValue(
      new URLSearchParams("source=status&recovery=0"),
    );

    render(<ViewerReportShell reportId={REPORT_ID} mode="form" />, {
      wrapper: Providers,
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/reports/latest?recovery=1");
      expect(screen.getByText(/opening the status report/i)).toBeVisible();
      expect(mockLogClientError).toHaveBeenCalledTimes(1);
    });
    expect(mockLogClientError).toHaveBeenCalledWith(
      "viewerReport.get.load_failed",
      error,
      expect.objectContaining({
        component: "ViewerReportShell",
        procedure: "weeklyReport.get",
      }),
    );
  });
});
