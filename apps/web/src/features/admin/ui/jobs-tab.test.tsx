// Stub tRPC proxy; drive captured mutationFn, not a real network.
import type { FailedJob } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
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

import { JobsTab } from "./jobs-tab";

const BASE_DESCRIPTORS = [
  { path: ["admin", "jobs", "retryFailed"], mutation: true as const },
  { path: ["admin", "dlqCount"] },
];

function makeMockTRPC(jobs: FailedJob[]) {
  return createMockTRPC([
    {
      path: ["admin", "jobs", "listFailed"],
      query: () => Promise.resolve({ jobs, nextCursor: null }),
    },
    ...BASE_DESCRIPTORS,
  ]);
}

function makePendingMockTRPC() {
  return createMockTRPC([
    // "pending" — never resolves so listQuery.isPending stays true.
    { path: ["admin", "jobs", "listFailed"], query: "pending" },
    ...BASE_DESCRIPTORS,
  ]);
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
  return createMockTRPC([
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
  ]);
}

function renderTab(jobs: FailedJob[]) {
  const { proxy, captured } = makeMockTRPC(jobs);
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
  return { captured };
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

  it("JobsSkeleton status region matches inline snapshot", () => {
    renderPendingTab();

    const skeleton = screen.getByTestId("jobs-loading-state");
    expect(skeleton).toMatchInlineSnapshot(`
      <div
        aria-label="Loading failed jobs"
        aria-live="polite"
        class="rounded-[var(--radius)] border border-[var(--color-border)]"
        data-testid="jobs-loading-state"
        role="status"
      >
        <div
          class="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3"
        >
          <div
            class="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
        </div>
        <div
          class="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
        </div>
        <div
          class="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
        </div>
        <div
          class="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
        </div>
        <div
          class="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
          <div
            class="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
          />
        </div>
      </div>
    `);
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
  });

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

    const loadMore = screen.getByRole("button", { name: "Load more" });
    await userEvent.setup().click(loadMore);

    // Second page rows appear and the cursor is exhausted.
    expect(await screen.findByText("job-050")).toBeInTheDocument();
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

  it("renders the queue header so the head knows which queue is shown", async () => {
    renderTab([]);
    expect(
      await screen.findByRole("heading", { name: /Failed Jobs/i }),
    ).toBeInTheDocument();
  });
});
