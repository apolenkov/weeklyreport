/**
 * Phase 35-06 — JobsTab wiring test.
 *
 * Strategy mirrors weekly-report-page.test.tsx: stub the tRPC proxy and
 * intercept `admin.jobs.listFailed.queryOptions` / `admin.jobs.retryFailed
 * .mutationOptions`. We don't drive a real network — we drive
 * captured.retryMutationFn directly and assert it received the right input.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TRPCProxyContext } from "../../lib/trpc-context";

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

import { JobsTab } from "./jobs-tab";

type FailedJob = {
  id: string;
  name: string;
  failedReason: string;
  stacktrace: string[];
  attemptsMade: number;
  timestamp: number;
  data: unknown;
};

type Captured = {
  retryOptions?: {
    onSuccess?: (result: { retried: boolean; jobId: string }) => void;
    onError?: (err: Error) => void;
  };
  retryMutationFn: ReturnType<typeof vi.fn>;
};

function makeMockTRPC(jobs: FailedJob[], captured: Captured) {
  return {
    admin: {
      jobs: {
        listFailed: {
          queryOptions: () => ({
            queryKey: ["admin", "jobs", "listFailed"],
            queryFn: async () => ({ jobs, nextCursor: null }),
          }),
          queryKey: () => ["admin", "jobs", "listFailed"],
        },
        retryFailed: {
          mutationOptions: (opts: Captured["retryOptions"]) => {
            captured.retryOptions = opts;
            return {
              mutationFn: captured.retryMutationFn,
              onSuccess: opts?.onSuccess,
              onError: opts?.onError,
            };
          },
        },
      },
      dlqCount: {
        queryKey: () => ["admin", "dlqCount"],
      },
    },
  } as never;
}

function makeJob(id: string, overrides: Partial<FailedJob> = {}): FailedJob {
  return {
    id,
    name: "send-reminder-email",
    failedReason: "SMTP timeout connecting to mailhog:1025",
    stacktrace: ["at smtpClient.send (smtp.ts:42)"],
    attemptsMade: 3,
    timestamp: Date.UTC(2026, 4, 1, 9, 0, 0),
    data: { recipient: "lead@example.com" },
    ...overrides,
  };
}

function renderTab(jobs: FailedJob[], captured: Captured) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC(jobs, captured);
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  return render(<JobsTab />, { wrapper: Wrapper });
}

describe("JobsTab — Phase 35-06 BullMQ DLQ admin UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state when there are no failed jobs", async () => {
    const captured: Captured = { retryMutationFn: vi.fn() };
    renderTab([], captured);

    expect(
      await screen.findByText(
        /No failed email reminder jobs\. Queue is clean\./,
      ),
    ).toBeInTheDocument();
  });

  it("renders 2 mock jobs and clicking Retry on job-1 fires the mutation with that jobId", async () => {
    const captured: Captured = {
      retryMutationFn: vi
        .fn()
        .mockResolvedValue({ retried: true, jobId: "job-1" }),
    };
    const jobs = [
      makeJob("job-1", { name: "send-reminder-email", attemptsMade: 3 }),
      makeJob("job-2", { name: "send-escalation-email", attemptsMade: 5 }),
    ];
    renderTab(jobs, captured);

    // Wait for both rows to render.
    await screen.findByText("job-1");
    expect(screen.getByText("job-2")).toBeInTheDocument();

    // Two retry buttons exist; click the one for job-1.
    const retryJob1 = screen.getByRole("button", { name: /Retry job job-1/i });
    await userEvent.click(retryJob1);

    await waitFor(() => {
      expect(captured.retryMutationFn).toHaveBeenCalledTimes(1);
    });

    // TanStack Query forwards (variables, context) → assert the first arg.
    expect(captured.retryMutationFn.mock.calls[0]?.[0]).toEqual({
      queue: "email-reminder",
      jobId: "job-1",
    });
  });

  it("on retry success: success toast fires when retried=true", async () => {
    const captured: Captured = {
      retryMutationFn: vi
        .fn()
        .mockResolvedValue({ retried: true, jobId: "job-1" }),
    };
    renderTab([makeJob("job-1")], captured);

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
    const captured: Captured = {
      retryMutationFn: vi
        .fn()
        .mockResolvedValue({ retried: false, jobId: "job-9" }),
    };
    renderTab([makeJob("job-9")], captured);

    await screen.findByText("job-9");
    await userEvent.click(
      screen.getByRole("button", { name: /Retry job job-9/i }),
    );

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalled();
    });
  });

  it("renders the queue header so the head knows which queue is shown", async () => {
    const captured: Captured = { retryMutationFn: vi.fn() };
    renderTab([], captured);
    expect(
      await screen.findByRole("heading", { name: /Failed Jobs/i }),
    ).toBeInTheDocument();
  });
});
