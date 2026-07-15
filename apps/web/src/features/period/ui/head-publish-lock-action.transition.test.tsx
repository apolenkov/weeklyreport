/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../lib/query-client";
import { SessionContext } from "../../../lib/session-provider";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { HeadPublishLockAction } from "./head-publish-lock-action";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../report-sections", () => ({
  mapWeeklyReport: (data: { reportId: string }) => ({
    submissionCount: 1,
    totalLeads: 1,
    products: [{}],
    period: {
      reportId: data.reportId,
      periodStatus: "open",
    },
  }),
  reportHasContent: () => true,
}));

vi.mock("./publish-lock-button", () => ({
  PublishLockButton: () => <button type="button">Publish &amp; Lock</button>,
}));

const pending = new Promise<never>(() => undefined);

function makeProviders() {
  const { proxy } = createMockTRPC([
    {
      path: ["weeklyReport", "get"],
      queryByInput: (input) =>
        (input as { reportId: string }).reportId === "report-a"
          ? { status: "active", reportId: "report-a" }
          : pending,
    },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
  ]);
  const client = makeQueryClient();

  return function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: "head-user",
              name: "Test Head",
              email: "head@example.com",
              role: "head",
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

describe("HeadPublishLockAction report-key transitions", () => {
  it("removes the report A publish trigger while report B is pending", async () => {
    const rendered = render(<HeadPublishLockAction reportId="report-a" />, {
      wrapper: makeProviders(),
    });
    expect(
      await screen.findByRole("button", { name: /publish & lock/i }),
    ).toBeEnabled();

    rendered.rerender(<HeadPublishLockAction reportId="report-b" />);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /publish|reopen/i }),
      ).not.toBeInTheDocument();
    });
  });
});
