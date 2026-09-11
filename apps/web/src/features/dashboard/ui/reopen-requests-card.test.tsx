// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { ReopenRequestsCard } from "./reopen-requests-card";

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const NEXT_CURSOR = {
  id: "00000000-0000-4000-8000-000000000002",
  createdAt: "2026-04-06T12:00:00.000Z",
} as const;

function makeRequest(id: string, name: string) {
  return {
    id,
    reportSectionId: `section-${id}`,
    reason: `${name} reason`,
    status: "pending" as const,
    reviewNote: null,
    reviewedAt: null,
    createdAt: "2026-04-06T12:00:00.000Z",
    requestedBy: {
      id: `user-${id}`,
      name,
      email: `${name.toLowerCase()}@test.local`,
    },
    reviewedBy: null,
    sectionStatus: "submitted" as const,
    report: {
      id: `report-${id}`,
      weekLabel: "W15-2026",
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-10T00:00:00.000Z",
    },
  };
}

interface RenderCardOptions {
  readonly list: unknown;
  readonly count?: unknown;
}

function renderCard({ list, count = { count: 2 } }: RenderCardOptions) {
  const mock = createMockTRPC([
    { path: ["admin", "listReopenRequests"], query: list },
    { path: ["admin", "pendingReopenCount"], query: count },
    { path: ["admin", "respondReopenRequest"], mutation: true },
    { path: ["review", "dashboard"], query: {} },
    { path: ["archive", "list"], query: {} },
    { path: ["weeklyReport", "get"], query: {} },
    { path: ["activity", "live"], query: {} },
    { path: ["reports", "getActive"], query: {} },
    { path: ["leadForm", "byPeriod"], query: {} },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={mock.proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const rendered = render(<ReopenRequestsCard />, { wrapper: Wrapper });
  return { ...mock, invalidateSpy, queryClient, ...rendered };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReopenRequestsCard", () => {
  it("renders nothing when the pending queue is empty", async () => {
    const { container } = renderCard({
      list: { items: [], nextCursor: null },
      count: { count: 0 },
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders a stable loading placeholder while the first page loads", () => {
    renderCard({ list: "pending" });

    expect(
      screen.getByRole("status", { name: /loading pending reopen requests/i }),
    ).toBeInTheDocument();
  });

  it("shows a retryable full-card issue when the first page fails", async () => {
    let attempts = 0;
    renderCard({
      list: () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("queue failed"));
        return Promise.resolve({
          items: [makeRequest("request-1", "Alice Lead")],
          nextCursor: null,
        });
      },
      count: { count: 1 },
    });

    expect(
      await screen.findByTestId("reopen-requests-error"),
    ).toHaveTextContent("queue failed");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Alice L.")).toBeInTheDocument();
  });

  it("uses the full pending count and recovers a failed later page without losing rows or draft", async () => {
    const inputs: Record<string, unknown>[] = [];
    let laterAttempts = 0;
    renderCard({
      list: (rawInput: unknown) => {
        const input = rawInput as Record<string, unknown>;
        inputs.push(input);
        if (input.cursor === undefined) {
          return Promise.resolve({
            items: [makeRequest("request-1", "Alice Lead")],
            nextCursor: NEXT_CURSOR,
          });
        }
        laterAttempts += 1;
        if (laterAttempts === 1) {
          return Promise.reject(new Error("next page failed"));
        }
        return Promise.resolve({
          items: [makeRequest("request-2", "Bob Lead")],
          nextCursor: null,
        });
      },
      count: { count: 117 },
    });

    const alice = expectDefined(
      (await screen.findByText("Alice L.")).closest("li"),
    );
    expect(screen.getByText("117 pending")).toBeInTheDocument();
    await userEvent.click(
      within(alice).getByRole("button", { name: "Respond" }),
    );
    await userEvent.type(within(alice).getByRole("textbox"), "Keep this draft");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "next page failed",
    );
    expect(screen.getByText("Alice L.")).toBeInTheDocument();
    expect(within(alice).getByRole("textbox")).toHaveValue("Keep this draft");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Bob L.")).toBeInTheDocument();
    expect(screen.getByText("Alice L.")).toBeInTheDocument();
    expect(inputs.at(-1)).toMatchObject({
      status: "pending",
      cursor: NEXT_CURSOR,
      direction: "forward",
    });
  });

  it("labels a loaded queue explicitly when the pending total is unavailable", async () => {
    renderCard({
      list: {
        items: [makeRequest("request-1", "Alice Lead")],
        nextCursor: NEXT_CURSOR,
      },
      count: () => Promise.reject(new Error("count failed")),
    });

    expect(
      await screen.findByText("Count unavailable · 1 loaded"),
    ).toBeInTheDocument();
  });

  it("submits a trimmed decision, resets the draft, and invalidates every list page", async () => {
    const { captured, invalidateSpy, proxy } = renderCard({
      list: {
        items: [makeRequest("request-1", "Alice Lead")],
        nextCursor: null,
      },
      count: { count: 1 },
    });
    const mutation = expectDefined(captured["admin.respondReopenRequest"]);
    mutation.mutationFn.mockResolvedValue({
      staleAutoClosed: false,
      decision: "approved",
    });

    const row = expectDefined(
      (await screen.findByText("Alice L.")).closest("li"),
    );
    await userEvent.click(within(row).getByRole("button", { name: "Respond" }));
    await userEvent.type(within(row).getByRole("textbox"), "  Looks good  ");
    await userEvent.click(within(row).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mutation.calls).toEqual([
        {
          id: "request-1",
          decision: "approved",
          note: "Looks good",
        },
      ]);
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Request approved; section reopened.",
    );
    expect(within(row).queryByRole("textbox")).not.toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith(
      proxy.admin.listReopenRequests.pathFilter(),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      proxy.admin.pendingReopenCount.pathFilter(),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      proxy.review.dashboard.pathFilter(),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      proxy.weeklyReport.get.pathFilter(),
    );
  });

  it("reports a stale auto-close without a success toast", async () => {
    const { captured } = renderCard({
      list: {
        items: [makeRequest("request-1", "Alice Lead")],
        nextCursor: null,
      },
    });
    const mutation = expectDefined(captured["admin.respondReopenRequest"]);
    mutation.mutationFn.mockResolvedValue({
      staleAutoClosed: true,
      decision: "approved",
    });

    const row = expectDefined(
      (await screen.findByText("Alice L.")).closest("li"),
    );
    await userEvent.click(within(row).getByRole("button", { name: "Respond" }));
    await userEvent.click(within(row).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "This section was already reopened; the request was closed.",
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
