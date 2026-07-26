/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../lib/query-client";
import {
  SessionContext,
  type SessionUser,
} from "../../../lib/session-provider";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { ViewerReportShell } from "../../viewer/ui/viewer-report-shell";
import { HeadReportShell } from "./head-report-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/head/report/report-a",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../pdf-export", () => ({
  ExportPdfButton: ({ reportId }: { reportId: string }) => (
    <button type="button">Export {reportId}</button>
  ),
}));

const pending = new Promise<never>(() => undefined);

function makeReport(reportId: string, weekLabel: string) {
  return {
    status: "active" as const,
    reportId,
    periodStart: new Date("2026-07-06T00:00:00Z"),
    periodEnd: new Date("2026-07-12T00:00:00Z"),
    deadline: new Date("2026-07-10T15:00:00Z"),
    periodStatus: "open" as const,
    weekLabel,
    submissionCount: 0,
    totalLeads: 0,
    hasActiveReminderRule: false,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
  };
}

function makeProviders(role: SessionUser["role"]) {
  const { proxy } = createMockTRPC([
    { path: ["reports", "compiledHistory"], query: { entries: [] } },
    {
      path: ["weeklyReport", "get"],
      queryByInput: (input) =>
        (input as { reportId?: string }).reportId !== "report-b"
          ? makeReport("report-a", "Report A period")
          : pending,
    },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    { path: ["archive", "archiveReport"], mutation: true },
    { path: ["archive", "unarchiveReport"], mutation: true },
  ]);
  const client = makeQueryClient();

  return function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: `${role}-user`,
              name: "Test User",
              email: `${role}@example.com`,
              role,
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  };
}

function renderHead() {
  const Providers = makeProviders("head");
  return render(<HeadReportShell reportId="report-a" mode="form" />, {
    wrapper: Providers,
  });
}

function renderViewer() {
  const Providers = makeProviders("viewer");
  return render(<ViewerReportShell reportId="report-a" mode="form" />, {
    wrapper: Providers,
  });
}

describe("report shell report-key transitions", () => {
  it("hides report A content and head actions while report B is pending", async () => {
    const rendered = renderHead();
    expect(await screen.findByText(/Report A period/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nothing to publish/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export report-a/i }),
    ).toBeEnabled();

    rendered.rerender(<HeadReportShell reportId="report-b" mode="form" />);

    await waitFor(() => {
      expect(screen.queryByText(/Report A period/)).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", {
        name: /publish|reopen|nothing to publish/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /export report-a/i }),
    ).toBeNull();
  });

  it("hides report A content and viewer export while report B is pending", async () => {
    const rendered = renderViewer();
    expect(await screen.findByText(/Report A period/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export report-a/i }),
    ).toBeEnabled();

    rendered.rerender(<ViewerReportShell reportId="report-b" mode="form" />);

    await waitFor(() => {
      expect(screen.queryByText(/Report A period/)).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /export report-a/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /publish|reopen/i }),
    ).toBeNull();
  });
});
