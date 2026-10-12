// Stub tRPC proxy; drive captured mutationFn, not a real network.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FailedJob } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logClientError } from "../../../shared/lib/errors/client-error-reporting";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";

const toastSuccess = vi.fn<(...args: unknown[]) => void>();
const toastError = vi.fn<(...args: unknown[]) => void>();
const toastInfo = vi.fn<(...args: unknown[]) => void>();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

vi.mock("../../../shared/lib/errors/client-error-reporting", () => ({
  logClientError: vi.fn(),
  formatClientErrorMessage: vi.fn(),
}));

import { JobsTab } from "./jobs-tab";

const BASE_DESCRIPTORS = [
  { path: ["admin", "jobs", "retryFailed"], mutation: true as const },
  { path: ["admin", "jobs", "removeFailed"], mutation: true as const },
  { path: ["admin", "dlqCount"], query: { count: 0, byQueue: [] } },
];

function withInfiniteListFilter(mock: ReturnType<typeof createMockTRPC>) {
  const listFailed = mock.proxy.admin.jobs.listFailed;
  Object.assign(listFailed, {
    infiniteQueryFilter: () => listFailed.pathFilter(),
  });
  return mock;
}

function makeMockTRPC(jobs: FailedJob[]) {
  const listQuery = vi.fn(() =>
    Promise.resolve({ jobs: [...jobs], nextCursor: null }),
  );
  const mock = withInfiniteListFilter(
    createMockTRPC([
      {
        path: ["admin", "jobs", "listFailed"],
        query: listQuery,
      },
      ...BASE_DESCRIPTORS,
    ]),
  );
  return { ...mock, listQuery };
}

function makePendingMockTRPC() {
  return withInfiniteListFilter(
    createMockTRPC([
      // "pending" — never resolves so listQuery.isPending stays true.
      { path: ["admin", "jobs", "listFailed"], query: "pending" },
      ...BASE_DESCRIPTORS,
    ]),
  );
}

function makeRecoveringMockTRPC() {
  let emailFailuresRemaining = 1;
  const listQuery = vi.fn((input: { queue: string }) => {
    if (input.queue === "email-reminder" && emailFailuresRemaining > 0) {
      emailFailuresRemaining -= 1;
      return Promise.reject(new Error("Failed to fetch"));
    }
    return Promise.resolve({
      jobs: [makeJob(`${input.queue}-recovered`)],
      nextCursor: null,
    });
  });
  const mock = withInfiniteListFilter(
    createMockTRPC([
      { path: ["admin", "jobs", "listFailed"], query: listQuery },
      ...BASE_DESCRIPTORS,
    ]),
  );
  return { ...mock, listQuery };
}

function makeJob(id: string, overrides: Partial<FailedJob> = {}): FailedJob {
  return {
    id,
    name: "send-reminder-email",
    failedReason: "SMTP timeout connecting to mailhog:1025",
    stacktrace: ["at smtpClient.send (smtp.ts:42)"],
    attemptsMade: 3,
    timestamp: Date.UTC(2026, 4, 1, 9, 0, 0),
    ...overrides,
  };
}

// Two cursor pages of 50; the factory pages by the injected `cursor`.
function makePagedMockTRPC() {
  const firstPage = Array.from({ length: 50 }, (_, i) =>
    makeJob(`job-${String(i).padStart(3, "0")}`),
  );
  const secondPage = Array.from({ length: 7 }, (_, i) =>
    makeJob(`job-${String(50 + i).padStart(3, "0")}`),
  );
  return withInfiniteListFilter(
    createMockTRPC([
      {
        path: ["admin", "jobs", "listFailed"],
        query: (input: { cursor?: number }) => {
          if (input.cursor === 0 || input.cursor === undefined) {
            return Promise.resolve({ jobs: firstPage, nextCursor: 50 });
          }
          return Promise.resolve({ jobs: secondPage, nextCursor: null });
        },
      },
      ...BASE_DESCRIPTORS,
    ]),
  );
}

function renderTab(jobs: FailedJob[]) {
  const { proxy, captured, listQuery } = makeMockTRPC(jobs);
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
  render(<JobsTab />, { wrapper: Wrapper });
  return { captured, listQuery };
}

function renderPendingTab() {
  const { proxy } = makePendingMockTRPC();
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
  render(<JobsTab />, { wrapper: Wrapper });
}

describe("JobsTab — JobsSkeleton a11y attributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("JobsSkeleton container has role='status'", () => {
    renderPendingTab();

    const skeleton = screen.getByTestId("jobs-loading-state");
    expect(skeleton).toHaveAttribute("role", "status");
  });

  it("JobsSkeleton container has aria-label='Loading failed jobs' and aria-live='polite'", () => {
    renderPendingTab();

    const skeleton = screen.getByTestId("jobs-loading-state");
    expect(skeleton).toHaveAttribute("aria-label", "Loading failed jobs");
    expect(skeleton).toHaveAttribute("aria-live", "polite");
  });
});

describe("JobsTab — BullMQ DLQ admin UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state when there are no failed jobs", async () => {
    renderTab([]);

    expect(
      await screen.findByText(
        /No failed email reminder jobs\. Queue is clean\./,
      ),
    ).toBeInTheDocument();
    // R54: nothing to search in an empty queue.
    expect(screen.getByTestId("jobs-search")).toBeDisabled();
  });

  it("opens on the first queue that has failed jobs and keeps it after a count refresh", async () => {
    const listQuery = vi.fn((input: { queue: string }) =>
      Promise.resolve({
        jobs: input.queue === "pdf-export" ? [makeJob("pdf-failure")] : [],
        nextCursor: null,
      }),
    );
    let byQueue = [
      { queue: "email-reminder", count: 0 },
      { queue: "pdf-export", count: 2 },
    ];
    const { proxy } = withInfiniteListFilter(
      createMockTRPC([
        { path: ["admin", "jobs", "listFailed"], query: listQuery },
        { path: ["admin", "jobs", "retryFailed"], mutation: true as const },
        { path: ["admin", "jobs", "removeFailed"], mutation: true as const },
        { path: ["admin", "dlqCount"], query: () => ({ count: 2, byQueue }) },
      ]),
    );
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(<JobsTab />, {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={qc}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      ),
    });

    expect(await screen.findByText("pdf-failure")).toBeInTheDocument();
    expect(screen.getByLabelText("Failed job queue")).toHaveValue("pdf-export");

    byQueue = byQueue.map((entry) => ({ ...entry, count: 0 }));
    await qc.invalidateQueries(proxy.admin.dlqCount.pathFilter());
    expect(screen.getByLabelText("Failed job queue")).toHaveValue("pdf-export");
  });

  it("keeps the loading state, not Queue is clean, until the failure count settles", async () => {
    const count = Promise.withResolvers<unknown>();
    const listQuery = vi.fn((input: { queue: string }) =>
      Promise.resolve({
        jobs: input.queue === "pdf-export" ? [makeJob("pdf-failure")] : [],
        nextCursor: null,
      }),
    );
    const { proxy } = withInfiniteListFilter(
      createMockTRPC([
        { path: ["admin", "jobs", "listFailed"], query: listQuery },
        { path: ["admin", "jobs", "retryFailed"], mutation: true as const },
        { path: ["admin", "jobs", "removeFailed"], mutation: true as const },
        { path: ["admin", "dlqCount"], query: () => count.promise },
      ]),
    );
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(<JobsTab />, {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={qc}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(listQuery).toHaveBeenCalled();
    });
    // Let the default queue's (empty) list land before asserting on it.
    await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
    expect(screen.getByTestId("jobs-loading-state")).toBeInTheDocument();
    expect(screen.queryByText(/Queue is clean/)).not.toBeInTheDocument();

    count.resolve({
      count: 2,
      byQueue: [
        { queue: "email-reminder", count: 0 },
        { queue: "pdf-export", count: 2 },
      ],
    });
    expect(await screen.findByText("pdf-failure")).toBeInTheDocument();
    expect(screen.queryByText(/Queue is clean/)).not.toBeInTheDocument();
  });

  it("stays on the default queue when the count failed and a later refresh succeeds", async () => {
    let failing = true;
    const { proxy } = withInfiniteListFilter(
      createMockTRPC([
        {
          path: ["admin", "jobs", "listFailed"],
          query: () => ({ jobs: [], nextCursor: null }),
        },
        { path: ["admin", "jobs", "retryFailed"], mutation: true as const },
        { path: ["admin", "jobs", "removeFailed"], mutation: true as const },
        {
          path: ["admin", "dlqCount"],
          query: () =>
            failing
              ? Promise.reject(new Error("count unavailable"))
              : { count: 2, byQueue: [{ queue: "pdf-export", count: 2 }] },
        },
      ]),
    );
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(<JobsTab />, {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={qc}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      ),
    });

    expect(
      await screen.findByText(/No failed email reminder jobs/),
    ).toBeInTheDocument();
    failing = false;
    await qc.invalidateQueries(proxy.admin.dlqCount.pathFilter());

    expect(screen.getByLabelText("Failed job queue")).toHaveValue(
      "email-reminder",
    );
  });

  it("never switches away from a queue the admin picked before the count arrived", async () => {
    const count = Promise.withResolvers<unknown>();
    const { proxy } = withInfiniteListFilter(
      createMockTRPC([
        {
          path: ["admin", "jobs", "listFailed"],
          query: () => ({ jobs: [], nextCursor: null }),
        },
        { path: ["admin", "jobs", "retryFailed"], mutation: true as const },
        { path: ["admin", "jobs", "removeFailed"], mutation: true as const },
        { path: ["admin", "dlqCount"], query: () => count.promise },
      ]),
    );
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(<JobsTab />, {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={qc}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      ),
    });

    await userEvent.selectOptions(
      screen.getByLabelText("Failed job queue"),
      "semantic-index",
    );
    count.resolve({
      count: 2,
      byQueue: [{ queue: "pdf-export", count: 2 }],
    });

    expect(
      await screen.findByText(/No failed semantic indexing jobs/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Failed job queue")).toHaveValue(
      "semantic-index",
    );
  });

  it("reports one structured list error, deduplicates rerenders, and recovers on queue change", async () => {
    const { proxy, captured } = makeRecoveringMockTRPC();
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
    const { rerender } = render(<JobsTab />, { wrapper });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load list: Failed to fetch",
    );
    await waitFor(() => expect(logClientError).toHaveBeenCalledTimes(1));
    expect(logClientError).toHaveBeenCalledWith(
      "admin.jobs.list_failed",
      expect.objectContaining({ message: "Failed to fetch" }),
      {
        component: "JobsTab",
        procedure: "admin.jobs.listFailed",
        queue: "email-reminder",
      },
    );

    rerender(<JobsTab />);
    const searchInput = screen.getByLabelText("Search failed jobs");
    await userEvent.type(searchInput, "x");
    expect(logClientError).toHaveBeenCalledTimes(1);
    await userEvent.clear(searchInput);

    await userEvent.selectOptions(
      screen.getByLabelText("Failed job queue"),
      "pdf-export",
    );
    expect(await screen.findByText("pdf-export-recovered")).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Failed job queue"),
      "email-reminder",
    );
    expect(
      await screen.findByText("email-reminder-recovered"),
    ).toBeInTheDocument();
    expect(logClientError).toHaveBeenCalledTimes(1);
    expect(
      expectDefined(captured["admin.jobs.retryFailed"]).mutationFn,
    ).not.toHaveBeenCalled();
    expect(
      expectDefined(captured["admin.jobs.removeFailed"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      "email-reminder",
      "Failed email reminder deliveries after all retries. Rules are configured in Reminders; this tab is only for delivery failures.",
      "No failed email reminder jobs. Queue is clean.",
    ],
    [
      "pdf-export",
      "Failed PDF export jobs after all retries.",
      "No failed PDF export jobs. Queue is clean.",
    ],
    [
      "ai-provider-test",
      "Failed AI provider test jobs after all retries.",
      "No failed AI provider test jobs. Queue is clean.",
    ],
    [
      "semantic-index",
      "Failed semantic indexing jobs after all retries.",
      "No failed semantic indexing jobs. Queue is clean.",
    ],
  ] as const)(
    "uses queue-aware copy for %s",
    async (queue, description, emptyState) => {
      renderTab([]);
      await userEvent
        .setup()
        .selectOptions(screen.getByLabelText("Failed job queue"), queue);

      expect(await screen.findByText(description)).toBeInTheDocument();
      expect(await screen.findByText(emptyState)).toBeInTheDocument();
      if (queue !== "email-reminder") {
        expect(
          screen.queryByText(/Failed email reminder deliveries/),
        ).toBeNull();
      }
    },
  );

  it("loads rows beyond the first 50-job page through Load more", async () => {
    const { proxy } = makePagedMockTRPC();
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
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
    render(<JobsTab />, { wrapper: Wrapper });

    // First page: 50 rows, still a further page.
    expect(await screen.findByText("job-000")).toBeInTheDocument();
    expect(screen.getByText("50 loaded+")).toBeInTheDocument();

    const user = userEvent.setup();
    const search = screen.getByTestId("jobs-search");
    await user.type(search, "job-049");
    expect(screen.getByText("1 matches · 50 loaded+")).toBeInTheDocument();
    expect(screen.queryByText("job-000")).not.toBeInTheDocument();
    expect(screen.getByText("job-049")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "missing");
    expect(screen.getByText("0 matches · 50 loaded+")).toBeInTheDocument();
    expect(
      screen.getByText("No failed jobs match the search."),
    ).toBeInTheDocument();
    await user.clear(search);
    expect(screen.getByText("50 loaded+")).toBeInTheDocument();
    await user.type(search, "job-05");
    expect(screen.getByText("0 matches · 50 loaded+")).toBeInTheDocument();

    const loadMore = screen.getByRole("button", { name: "Load more" });
    await userEvent.setup().click(loadMore);

    // Second page rows appear and the cursor is exhausted.
    expect(await screen.findByText("job-050")).toBeInTheDocument();
    expect(screen.getByText("7 matches · 57 loaded")).toBeInTheDocument();
    await user.clear(search);
    expect(screen.getByText("57 loaded")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("renders 2 mock jobs and clicking Retry on job-1 fires the mutation with that jobId", async () => {
    const jobs = [
      makeJob("job-1", { name: "send-reminder-email", attemptsMade: 3 }),
      makeJob("job-2", { name: "send-escalation-email", attemptsMade: 5 }),
    ];
    const { captured } = renderTab(jobs);
    const retryMutationFn = expectDefined(
      captured["admin.jobs.retryFailed"],
    ).mutationFn;
    retryMutationFn.mockResolvedValue({ retried: true, jobId: "job-1" });

    await screen.findByText("job-1");
    expect(screen.getByText("job-2")).toBeInTheDocument();

    const retryJob1 = screen.getByRole("button", { name: /Retry job job-1/i });
    await userEvent.click(retryJob1);

    await waitFor(() => {
      expect(retryMutationFn).toHaveBeenCalledTimes(1);
    });

    // TanStack Query forwards (variables, context) → assert the first arg.
    expect(retryMutationFn.mock.calls[0]?.[0]).toEqual({
      queue: "email-reminder",
      jobId: "job-1",
    });
  });

  it("on retry success: success toast fires when retried=true", async () => {
    const { captured } = renderTab([makeJob("job-1")]);
    expectDefined(
      captured["admin.jobs.retryFailed"],
    ).mutationFn.mockResolvedValue({
      retried: true,
      jobId: "job-1",
    });

    await screen.findByText("job-1");
    await userEvent.click(
      screen.getByRole("button", { name: /Retry job job-1/i }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
    });
    const message = toastSuccess.mock.calls[0]?.[0];
    expect(String(message)).toMatch(/job-1/);
  });

  it("on retry result {retried: false}: info toast (job no longer exists)", async () => {
    const { captured } = renderTab([makeJob("job-9")]);
    expectDefined(
      captured["admin.jobs.retryFailed"],
    ).mutationFn.mockResolvedValue({
      retried: false,
      jobId: "job-9",
    });

    await screen.findByText("job-9");
    await userEvent.click(
      screen.getByRole("button", { name: /Retry job job-9/i }),
    );

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalled();
    });
  });

  it("on retry result {removed: true}: info toast explains stale job cleanup", async () => {
    const { captured } = renderTab([makeJob("job-stale")]);
    expectDefined(
      captured["admin.jobs.retryFailed"],
    ).mutationFn.mockResolvedValue({
      retried: false,
      removed: true,
      reason: "Reminder execution missing.",
      jobId: "job-stale",
    });

    await screen.findByText("job-stale");
    await userEvent.click(
      screen.getByRole("button", { name: /Retry job job-stale/i }),
    );

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalledWith("Reminder execution missing.");
    });
  });

  it("confirms removal with the selected queue and job, then refreshes the UI", async () => {
    const jobs = [makeJob("job-remove")];
    const { captured, listQuery } = renderTab(jobs);
    const removeMutationFn = expectDefined(
      captured["admin.jobs.removeFailed"],
    ).mutationFn;
    removeMutationFn.mockImplementation(() => {
      jobs.splice(0);
      return Promise.resolve({ removed: true, jobId: "job-remove" });
    });

    await screen.findByText("job-remove");
    await userEvent.selectOptions(
      screen.getByLabelText("Failed job queue"),
      "pdf-export",
    );
    const callsBeforeRemove = listQuery.mock.calls.length;
    await userEvent.click(
      screen.getByRole("button", { name: "Remove failed job job-remove" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Remove failed job?",
    });
    expect(removeMutationFn).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove" }),
    );

    await waitFor(() => expect(removeMutationFn).toHaveBeenCalledOnce());
    expect(removeMutationFn.mock.calls[0]?.[0]).toEqual({
      queue: "pdf-export",
      jobId: "job-remove",
    });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      "Job job-remove removed from failed jobs.",
    );
    await waitFor(() =>
      expect(listQuery).toHaveBeenCalledTimes(callsBeforeRemove + 1),
    );
    expect(screen.queryByText("job-remove")).not.toBeInTheDocument();
    expect(
      screen.getByText("No failed PDF export jobs. Queue is clean."),
    ).toBeInTheDocument();
  });

  it("cancels removal without invoking the mutation", async () => {
    const { captured } = renderTab([makeJob("job-cancel")]);
    const removeMutationFn = expectDefined(
      captured["admin.jobs.removeFailed"],
    ).mutationFn;

    await screen.findByText("job-cancel");
    await userEvent.click(
      screen.getByRole("button", { name: "Remove failed job job-cancel" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Remove failed job?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    expect(removeMutationFn).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry job job-cancel" }),
    ).toBeEnabled();
  });

  it("renders the queue header so the head knows which queue is shown", async () => {
    renderTab([]);
    expect(
      await screen.findByRole("heading", { name: /Failed Jobs/i }),
    ).toBeInTheDocument();
  });
});
