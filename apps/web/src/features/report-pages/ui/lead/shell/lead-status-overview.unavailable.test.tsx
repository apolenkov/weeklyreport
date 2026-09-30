// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadStatusOverview } from "./lead-status-overview";

const REPORT_ID = "a0000000-0000-4000-8000-000000000999";

// A malformed id reaches the client as a raw Zod issues array, never prose.
const RAW_ZOD_MESSAGE =
  '[{"origin":"string","code":"invalid_format","format":"uuid","pattern":"/^[0-9a-f]{8}/i"}]';

function badRequest(): TRPCClientError<never> {
  const error = new TRPCClientError<never>(RAW_ZOD_MESSAGE);
  Object.defineProperty(error, "data", {
    value: { code: "BAD_REQUEST", httpStatus: 400 },
    configurable: true,
  });
  return error;
}

vi.mock("./use-lead-form-editor", () => ({
  useLeadFormEditor: () => ({ status: "loading", mode: "overview" }),
}));

function renderUnavailableOverview() {
  const { proxy } = createMockTRPC([
    { path: ["reports", "getActive"], query: null },
    {
      path: ["leadForm", "statusOverview"],
      query: () => {
        throw badRequest();
      },
    },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider
        value={{
          user: {
            id: "lead-1",
            name: "Test Lead",
            email: "lead@example.test",
            role: "lead",
          } as never,
          organization: null,
          isLoading: false,
          isAuthenticated: true,
        }}
      >
        <TRPCProxyContext.Provider value={proxy}>
          <LeadStatusOverview reportId={REPORT_ID} />
        </TRPCProxyContext.Provider>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
}

describe("LeadStatusOverview unavailable state", () => {
  it("shows the failure reason and a way back to the current report", async () => {
    renderUnavailableOverview();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Status overview unavailable");
    expect(alert).toHaveTextContent(
      "Failed to load status overview: This link is invalid or the report no longer exists.",
    );
    expect(alert).not.toHaveTextContent("pattern");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the current report" }),
    ).toHaveAttribute("href", "/lead/report");
  });
});
