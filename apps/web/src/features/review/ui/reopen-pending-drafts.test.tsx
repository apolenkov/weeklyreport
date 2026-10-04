import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { ReopenRequestsCard } from "../../dashboard/ui/reopen-requests-card";
import type { ReopenRequest } from "./reopen-request-card";
import { ReopenTab } from "./reopen-tab";
import { ReopenTabLabel } from "./reopen-tab-label";

const clientErrorReporting = vi.hoisted(() => ({
  logClientError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock(
  "../../../shared/lib/errors/client-error-reporting",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../shared/lib/errors/client-error-reporting")
    >()),
    logClientError: clientErrorReporting.logClientError,
  }),
);

afterEach(() => {
  vi.unstubAllGlobals();
  clientErrorReporting.logClientError.mockClear();
});

const requests: readonly ReopenRequest[] = ["Alice", "Bob"].map(
  (name, index) => ({
    id: `request-${index}`,
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
  }),
);

const NEXT_CURSOR = {
  id: "00000000-0000-4000-8000-000000000002",
  createdAt: "2026-04-06T12:00:00.000Z",
} as const;

function renderAdminList(
  query: (input: unknown) => unknown,
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  }),
) {
  const { proxy } = createMockTRPC([
    { path: ["admin", "listReopenRequests"], query },
    { path: ["admin", "pendingReopenCount"], query: { count: 2 } },
    { path: ["admin", "respondReopenRequest"], mutation: true },
  ]);
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  render(<ReopenTab />, { wrapper: Wrapper });
}

function mountQueue(Component: typeof ReopenTab | typeof ReopenRequestsCard) {
  const reportInput = { reportId: "a0000000-0000-4000-8000-000000000001" };
  const pending = Promise.withResolvers<{
    staleAutoClosed: boolean;
    decision: "approved";
  }>();
  let reviewCalls = 0;
  let weeklyReportCalls = 0;
  let leadFormCalls = 0;
  let activeReportCalls = 0;
  const { proxy, captured } = createMockTRPC([
    {
      path: ["admin", "listReopenRequests"],
      query: { items: requests, nextCursor: null },
    },
    { path: ["admin", "pendingReopenCount"], query: { count: 2 } },
    { path: ["admin", "respondReopenRequest"], mutation: true },
    {
      path: ["review", "dashboard"],
      query: () => ({
        sectionStatus: ++reviewCalls === 1 ? "submitted" : "draft",
      }),
    },
    { path: ["archive", "list"], query: {} },
    {
      path: ["weeklyReport", "get"],
      query: () => ({ submissionCount: ++weeklyReportCalls === 1 ? 4 : 3 }),
    },
    { path: ["activity", "live"], query: {} },
    {
      path: ["leadForm", "byPeriod"],
      query: () => ({ editable: ++leadFormCalls > 1 }),
    },
    {
      path: ["reports", "getActive"],
      query: () => ({ editable: ++activeReportCalls > 1 }),
    },
  ]);
  const mutation = expectDefined(captured["admin.respondReopenRequest"]);
  mutation.mutationFn.mockReturnValue(pending.promise);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  function LiveReportObservers() {
    useQuery(proxy.review.dashboard.queryOptions());
    useQuery(proxy.weeklyReport.get.queryOptions({}));
    useQuery(proxy.leadForm.byPeriod.queryOptions(reportInput));
    useQuery(proxy.reports.getActive.queryOptions());
    return null;
  }
  render(
    <>
      <Component />
      <LiveReportObservers />
    </>,
    { wrapper: Wrapper },
  );
  return {
    pending,
    mutation,
    dependentReadState: () => ({
      sectionStatus: queryClient.getQueryData<{ sectionStatus: string }>(
        proxy.review.dashboard.queryKey(),
      )?.sectionStatus,
      submissionCount: queryClient.getQueryData<{ submissionCount: number }>(
        proxy.weeklyReport.get.queryKey(),
      )?.submissionCount,
      leadEditable: queryClient.getQueryData<{ editable: boolean }>(
        proxy.leadForm.byPeriod.queryKey(reportInput),
      )?.editable,
      activeEditable: queryClient.getQueryData<{ editable: boolean }>(
        proxy.reports.getActive.queryKey(),
      )?.editable,
    }),
  };
}

describe.each([
  { name: "Dashboard", Component: ReopenRequestsCard },
  { name: "Admin", Component: ReopenTab },
])("$name response draft", ({ Component }) => {
  it.each(["success", "failure"] as const)(
    "keeps draft ownership and refreshes dependent reads after response %s",
    async (outcome) => {
      const { pending, mutation, dependentReadState } = mountQueue(Component);
      const user = userEvent.setup();
      await screen.findByText("Alice");
      await waitFor(() => {
        expect(dependentReadState()).toEqual({
          sectionStatus: "submitted",
          submissionCount: 4,
          leadEditable: false,
          activeEditable: false,
        });
      });
      const alice = expectDefined(screen.getByText("Alice").closest("li"));
      const bob = expectDefined(screen.getByText("Bob").closest("li"));
      await user.click(within(alice).getByRole("button", { name: "Respond" }));
      const note = within(alice).getByRole("textbox");
      await user.type(note, "Alice submitted note");
      await user.click(within(alice).getByRole("button", { name: "Approve" }));
      await waitFor(() => expect(mutation.calls).toHaveLength(1));

      const bobRespond = within(bob).getByRole("button", { name: "Respond" });
      expect(bobRespond).toBeDisabled();
      expect(note).toBeDisabled();
      await user.click(bobRespond);
      await user.type(note, " unsent replacement");
      expect(within(bob).queryByRole("textbox")).not.toBeInTheDocument();
      expect(note).toHaveValue("Alice submitted note");

      await act(async () => {
        if (outcome === "success")
          pending.resolve({ staleAutoClosed: false, decision: "approved" });
        else pending.reject(new Error("Response failed"));
        await pending.promise.catch(() => undefined);
      });
      await waitFor(() => {
        expect(dependentReadState()).toEqual({
          sectionStatus: "draft",
          submissionCount: 3,
          leadEditable: true,
          activeEditable: true,
        });
      });
      await waitFor(() => expect(bobRespond).toBeEnabled());
      if (outcome === "success") {
        expect(within(alice).queryByRole("textbox")).not.toBeInTheDocument();
      } else {
        expect(note).toBeEnabled();
        expect(note).toHaveValue("Alice submitted note");
        await user.type(note, " corrected");
        expect(note).toHaveValue("Alice submitted note corrected");
      }
      await user.click(bobRespond);
      const nextNote = within(bob).getByRole("textbox");
      expect(nextNote).toHaveValue("");
      await user.type(nextNote, "Bob new note");
      expect(nextNote).toHaveValue("Bob new note");
      expect(mutation.calls).toEqual([
        { id: "request-0", decision: "approved", note: "Alice submitted note" },
      ]);
    },
  );
});

describe("Admin reopen response cache recovery", () => {
  it("preserves the rejected draft while refreshing a race-terminal row and pending count", async () => {
    const response = Promise.withResolvers<never>();
    const listRefresh = Promise.withResolvers<{
      items: readonly ReopenRequest[];
      nextCursor: null;
    }>();
    let listCalls = 0;
    let countCalls = 0;
    const { proxy, captured } = createMockTRPC([
      {
        path: ["admin", "listReopenRequests"],
        query: () => {
          listCalls += 1;
          if (listCalls === 1) {
            return Promise.resolve({ items: [requests[0]], nextCursor: null });
          }
          return listRefresh.promise;
        },
      },
      {
        path: ["admin", "pendingReopenCount"],
        query: () => {
          countCalls += 1;
          return Promise.resolve({ count: countCalls === 1 ? 1 : 0 });
        },
      },
      { path: ["admin", "respondReopenRequest"], mutation: true },
      { path: ["review", "dashboard"], query: {} },
      { path: ["archive", "list"], query: {} },
      { path: ["weeklyReport", "get"], query: {} },
      { path: ["activity", "live"], query: {} },
      { path: ["reports", "getActive"], query: {} },
      { path: ["leadForm", "byPeriod"], query: {} },
    ]);
    const mutation = expectDefined(captured["admin.respondReopenRequest"]);
    mutation.mutationFn.mockReturnValue(response.promise);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      );
    }
    render(
      <>
        <ReopenTabLabel />
        <ReopenTab />
      </>,
      { wrapper: Wrapper },
    );

    const alice = expectDefined(
      (await screen.findByText("Alice")).closest("li"),
    );
    expect(await screen.findByTestId("reopen-tab-count")).toHaveTextContent(
      "1",
    );
    await userEvent.click(
      within(alice).getByRole("button", { name: "Respond" }),
    );
    const note = within(alice).getByRole("textbox");
    await userEvent.type(note, "Keep the race note");
    await userEvent.click(
      within(alice).getByRole("button", { name: "Approve" }),
    );
    await waitFor(() => expect(mutation.calls).toHaveLength(1));

    const conflict = Object.assign(new Error("Request already processed"), {
      data: { code: "CONFLICT", httpStatus: 409 },
    });
    await act(async () => {
      response.reject(conflict);
      await response.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(listCalls).toBe(2);
      expect(countCalls).toBe(2);
      expect(
        queryClient.getQueryData(proxy.admin.pendingReopenCount.queryKey()),
      ).toEqual({ count: 0 });
    });
    expect(note).toBeEnabled();
    expect(note).toHaveValue("Keep the race note");

    listRefresh.resolve({ items: [], nextCursor: null });
    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });
});

describe("Admin reopen pagination", () => {
  it("shows a retryable full-list issue when the first page fails", async () => {
    let attempts = 0;
    renderAdminList(() => {
      attempts += 1;
      if (attempts === 1) {
        const error = new TRPCClientError(
          JSON.stringify([
            {
              code: "invalid_format",
              pattern: "/^uuid$/",
              path: ["reportId"],
            },
          ]),
        );
        Object.defineProperty(error, "data", {
          value: { code: "BAD_REQUEST", httpStatus: 400 },
          configurable: true,
        });
        return Promise.reject(error);
      }
      return Promise.resolve({ items: [requests[0]], nextCursor: null });
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Failed to load requests: This link is invalid or the report no longer exists.",
    );
    expect(alert).not.toHaveTextContent("pattern");
    expect(clientErrorReporting.logClientError).toHaveBeenCalledWith(
      "admin.reopen_requests.list_failed",
      expect.objectContaining({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      }),
      {
        component: "ReopenTab",
        procedure: "admin.listReopenRequests",
        status: "pending",
        search: null,
      },
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("retains the loaded row and response draft while a later page fails, then appends on Retry", async () => {
    let laterAttempts = 0;
    renderAdminList((rawInput) => {
      const input = rawInput as { cursor?: unknown };
      if (input.cursor === undefined) {
        return Promise.resolve({
          items: [requests[0]],
          nextCursor: NEXT_CURSOR,
        });
      }
      laterAttempts += 1;
      if (laterAttempts === 1) {
        return Promise.reject(new Error("older requests failed"));
      }
      return Promise.resolve({ items: [requests[1]], nextCursor: null });
    });

    const alice = expectDefined(
      (await screen.findByText("Alice")).closest("li"),
    );
    expect(screen.getByText("1 loaded")).toBeInTheDocument();
    await userEvent.click(
      within(alice).getByRole("button", { name: "Respond" }),
    );
    await userEvent.type(
      within(alice).getByRole("textbox"),
      "Keep admin draft",
    );
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "older requests failed",
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(within(alice).getByRole("textbox")).toHaveValue("Keep admin draft");

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveFocus();
    const retainedDraft = within(alice).getByRole("textbox");
    await userEvent.type(retainedDraft, " corrected");
    expect(retainedDraft).toHaveFocus();
    await userEvent.click(retry);
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2 requests")).toBeInTheDocument();
  });

  it("starts a fresh server traversal for trimmed search and status changes", async () => {
    const inputs: Record<string, unknown>[] = [];
    renderAdminList((rawInput) => {
      const input = rawInput as Record<string, unknown>;
      inputs.push(input);
      const selected = input.search === "Bob" ? requests[1] : requests[0];
      return Promise.resolve({ items: [selected], nextCursor: NEXT_CURSOR });
    });

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
      name: "Lead, email, or week…",
    });
    await userEvent.type(search, "  Bob  ");
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approved" }));

    await waitFor(() => {
      expect(inputs).toContainEqual({
        status: "pending",
        search: "Bob",
        direction: "forward",
      });
      expect(inputs).toContainEqual({
        status: "approved",
        search: "Bob",
        direction: "forward",
      });
    });
  });

  it("starts again at page one when returning to a fresh cached filter", async () => {
    let pendingFirstPageCalls = 0;
    const approved = {
      ...requests[0],
      id: "request-approved",
      status: "approved" as const,
      requestedBy: { name: "Carol", email: "carol@example.com" },
    };
    renderAdminList((rawInput) => {
      const input = rawInput as { status: string; cursor?: unknown };
      if (input.status === "approved") {
        return Promise.resolve({ items: [approved], nextCursor: null });
      }
      if (input.cursor !== undefined) {
        return Promise.resolve({ items: [requests[1]], nextCursor: null });
      }
      pendingFirstPageCalls += 1;
      return Promise.resolve({ items: [requests[0]], nextCursor: NEXT_CURSOR });
    }, makeQueryClient());

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Bob")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(await screen.findByText("Carol")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pending" }));

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.queryByText("Carol")).not.toBeInTheDocument();
    });
    expect(pendingFirstPageCalls).toBe(2);
  });
});

function trpcResponse(data: unknown): Response {
  return new Response(JSON.stringify([{ result: { data: { json: data } } }]), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function transportInput(request: RequestInfo | URL): Record<string, unknown> {
  const href =
    typeof request === "string"
      ? request
      : request instanceof URL
        ? request.href
        : request.url;
  const encoded = new URL(href, "http://localhost").searchParams.get("input");
  const batch = JSON.parse(encoded ?? "{}") as Record<
    string,
    { json?: Record<string, unknown> }
  >;
  return batch["0"]?.json ?? {};
}

describe("Admin reopen pagination through the real tRPC transport", () => {
  it("sends the framework direction and compound cursor accepted by the API contract", async () => {
    const inputs: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((request: RequestInfo | URL) => {
        const input = transportInput(request);
        inputs.push(input);
        return Promise.resolve(
          trpcResponse(
            input.cursor === undefined
              ? { items: [requests[0]], nextCursor: NEXT_CURSOR }
              : { items: [requests[1]], nextCursor: null },
          ),
        );
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const proxy = makeTRPCProxy(queryClient);
    function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      );
    }
    render(<ReopenTab />, { wrapper: Wrapper });

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(inputs).toEqual([
      { status: "pending", direction: "forward" },
      { status: "pending", cursor: NEXT_CURSOR, direction: "forward" },
    ]);
  });
});
