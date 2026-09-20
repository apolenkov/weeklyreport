// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadStatusOverview } from "./lead-status-overview";

vi.mock("./use-lead-form-editor", () => ({
  useLeadFormEditor: () => ({ status: "loading", mode: "overview" }),
}));

function renderLoadingOverview() {
  const { proxy } = createMockTRPC([
    { path: ["reports", "getActive"], query: null },
    { path: ["leadForm", "statusOverview"], query: null },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider
        value={{
          user: null,
          organization: null,
          isLoading: true,
          isAuthenticated: false,
        }}
      >
        <TRPCProxyContext.Provider value={proxy}>
          <LeadStatusOverview />
        </TRPCProxyContext.Provider>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
}

describe("LeadStatusOverview loading layout", () => {
  it("keeps the report-page position-width landmark while loading", () => {
    renderLoadingOverview();

    const root = screen.getByRole("status", {
      name: "Loading status overview",
    });
    expect(root).toHaveAttribute("data-layout-key", "report-page");
    expect(root).toHaveAttribute("data-layout-stability", "position-width");
  });
});
