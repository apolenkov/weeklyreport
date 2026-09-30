// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { ReopenRequest } from "./reopen-request-card";
import { ReopenTab } from "./reopen-tab";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const request = (id: string, name: string): ReopenRequest => ({
  id,
  status: "pending",
  reason: `${name} reason`,
  reviewNote: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-04-06T12:00:00.000Z",
  requestedBy: { name, email: `${name.toLowerCase()}@example.com` },
  report: {
    periodStart: "2026-04-06T00:00:00.000Z",
    periodEnd: "2026-04-10T00:00:00.000Z",
    weekLabel: null,
  },
});

async function renderTab() {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["admin", "listReopenRequests"],
      query: {
        items: [request("r-1", "Alice"), request("r-2", "Bob")],
        nextCursor: null,
      },
    },
    { path: ["admin", "pendingReopenCount"], query: { count: 2 } },
    { path: ["admin", "respondReopenRequest"], mutation: true },
    { path: ["review", "dashboard"], query: {} },
    { path: ["archive", "list"], query: {} },
    { path: ["weeklyReport", "get"], query: {} },
    { path: ["activity", "live"], query: {} },
    { path: ["reports", "getActive"], query: {} },
    { path: ["leadForm", "byPeriod"], query: {} },
  ]);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        {children}
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  render(<ReopenTab />, { wrapper });
  const alice = expectDefined((await screen.findByText("Alice")).closest("li"));
  return {
    alice,
    decide: expectDefined(captured["admin.respondReopenRequest"]).mutationFn,
  };
}

describe("ReopenTab focus", () => {
  it("returns focus to the same Respond button after Cancel", async () => {
    const { alice } = await renderTab();

    await userEvent.click(
      within(alice).getByRole("button", { name: "Respond" }),
    );
    expect(within(alice).getByRole("textbox")).toHaveFocus();
    await userEvent.click(
      within(alice).getByRole("button", { name: "Cancel" }),
    );

    expect(
      within(alice).getByRole("button", { name: "Respond" }),
    ).toHaveFocus();
  });

  it.each([
    ["Approve", "approved"],
    ["Reject", "rejected"],
  ] as const)(
    "moves focus to the request list after %s removes the form",
    async (label, decision) => {
      const { alice, decide } = await renderTab();
      decide.mockResolvedValue({ staleAutoClosed: false, decision });

      await userEvent.click(
        within(alice).getByRole("button", { name: "Respond" }),
      );
      await userEvent.click(within(alice).getByRole("button", { name: label }));

      await waitFor(() => {
        expect(
          screen.getByRole("list", { name: "Reopen requests" }),
        ).toHaveFocus();
      });
      expect(within(alice).queryByRole("textbox")).not.toBeInTheDocument();
    },
  );
});
