import type { ProjectActivity } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { ActivitiesTab } from "./activities-tab";

const clientErrorReporting = vi.hoisted(() => ({
  logClientError: vi.fn(),
  formatClientErrorMessage: vi.fn(
    (prefix: string, _error: unknown): string => `${prefix}.`,
  ),
}));
vi.mock(
  "../../../shared/lib/errors/client-error-reporting",
  () => clientErrorReporting,
);
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ACTIVITY_ID = "66666666-6666-4666-8666-666666666666";

const activity: ProjectActivity = {
  id: ACTIVITY_ID,
  name: "Onboarding Revamp",
  groupId: "11111111-1111-4111-8111-111111111111",
  linkedProducts: [],
  jiraAccounts: [],
  archived: false,
  leadIds: [],
};

function renderTab(listQuery: () => unknown) {
  const { proxy } = createMockTRPC([
    { path: ["projectActivity", "list"], query: listQuery },
    { path: ["projectActivity", "create"], mutation: true },
    { path: ["projectActivity", "update"], mutation: true },
    { path: ["projectActivity", "archive"], mutation: true },
  ]);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const view = render(<ActivitiesTab groups={[]} users={[]} products={[]} />, {
    wrapper: Wrapper,
  });

  return { qc, view };
}

describe("ActivitiesTab — query error policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs each failed load transition once and keeps the visible retry", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce([activity])
      .mockRejectedValueOnce(new Error("still down"));
    const { qc, view } = renderTab(fetchImpl);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() =>
      expect(clientErrorReporting.logClientError).toHaveBeenCalledTimes(1),
    );
    expect(clientErrorReporting.logClientError).toHaveBeenLastCalledWith(
      "admin.activities.load_failed",
      expect.any(Error),
      { component: "ActivitiesTab", procedure: "projectActivity.list" },
    );

    // Re-rendering the same query error is not a new transition.
    view.rerender(<ActivitiesTab groups={[]} users={[]} products={[]} />);
    expect(clientErrorReporting.logClientError).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Onboarding Revamp")).toBeInTheDocument();
    expect(clientErrorReporting.logClientError).toHaveBeenCalledTimes(1);

    // A later failed refetch is a new error transition and logs once more.
    await act(async () => {
      await qc.invalidateQueries({
        queryKey: [["projectActivity", "list"]],
      });
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() =>
      expect(clientErrorReporting.logClientError).toHaveBeenCalledTimes(2),
    );
  });
});
