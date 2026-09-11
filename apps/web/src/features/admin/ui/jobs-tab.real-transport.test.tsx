import type { FailedJob } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { JobsTab } from "./jobs-tab";

const JOB: FailedJob = {
  id: "job-refresh-proof",
  name: "send-reminder-email",
  failedReason: "SMTP timeout",
  stacktrace: ["at smtpClient.send (smtp.ts:42)"],
  attemptsMade: 3,
  timestamp: Date.UTC(2026, 4, 1, 9, 0, 0),
};

function trpcResponse(data: unknown): Response {
  return new Response(JSON.stringify([{ result: { data: { json: data } } }]), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function requestPath(input: RequestInfo | URL): string {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return decodeURIComponent(new URL(url, "http://localhost").pathname).replace(
    "/trpc/",
    "",
  );
}

function renderWithRealTransport(action: "retry" | "remove") {
  const requestPaths: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = requestPath(input);
      requestPaths.push(path);
      if (path === "admin.jobs.listFailed") {
        const listRequestCount = requestPaths.filter(
          (item) => item === path,
        ).length;
        return Promise.resolve(
          trpcResponse({
            jobs: listRequestCount === 1 ? [JOB] : [],
            nextCursor: null,
          }),
        );
      }
      if (path === "admin.jobs.retryFailed" && action === "retry") {
        return Promise.resolve(trpcResponse({ retried: true, jobId: JOB.id }));
      }
      if (path === "admin.jobs.removeFailed" && action === "remove") {
        return Promise.resolve(trpcResponse({ removed: true, jobId: JOB.id }));
      }
      throw new Error(`Unexpected tRPC request: ${path}`);
    }),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
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
  render(<JobsTab />, { wrapper: Wrapper });
  return { invalidateSpy, proxy, requestPaths };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("JobsTab failed-list refresh through the real tRPC transport", () => {
  it.each(["retry", "remove"] as const)(
    "%s success refetches the infinite list and removes the stale row",
    async (action) => {
      const { invalidateSpy, proxy, requestPaths } =
        renderWithRealTransport(action);

      expect(await screen.findByText(JOB.id)).toBeInTheDocument();
      if (action === "retry") {
        await userEvent.click(
          screen.getByRole("button", { name: `Retry job ${JOB.id}` }),
        );
      } else {
        await userEvent.click(
          screen.getByRole("button", {
            name: `Remove failed job ${JOB.id}`,
          }),
        );
        const dialog = await screen.findByRole("alertdialog", {
          name: "Remove failed job?",
        });
        await userEvent.click(
          within(dialog).getByRole("button", { name: "Remove" }),
        );
      }

      await waitFor(() => {
        expect(screen.queryByTestId(`jobs-row-${JOB.id}`)).toBeNull();
      });
      expect(
        requestPaths.filter((path) => path === "admin.jobs.listFailed"),
      ).toHaveLength(2);
      expect(invalidateSpy).toHaveBeenCalledWith(
        proxy.admin.jobs.listFailed.infiniteQueryFilter({
          queue: "email-reminder",
        }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        proxy.admin.dlqCount.pathFilter(),
      );
    },
  );

  it("refreshes the retried job's queue when selection changes while retry is pending", async () => {
    const retryResponse = Promise.withResolvers<Response>();
    const requestPaths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const path = requestPath(input);
        requestPaths.push(path);
        if (path === "admin.jobs.listFailed") {
          return Promise.resolve(
            trpcResponse({ jobs: [JOB], nextCursor: null }),
          );
        }
        if (path === "admin.jobs.retryFailed") return retryResponse.promise;
        throw new Error(`Unexpected tRPC request: ${path}`);
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
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
    render(<JobsTab />, { wrapper: Wrapper });

    expect(await screen.findByText(JOB.id)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: `Retry job ${JOB.id}` }),
    );
    await waitFor(() => {
      expect(requestPaths).toContain("admin.jobs.retryFailed");
    });
    await userEvent.selectOptions(
      screen.getByLabelText("Failed job queue"),
      "pdf-export",
    );

    retryResponse.resolve(trpcResponse({ retried: true, jobId: JOB.id }));
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        proxy.admin.jobs.listFailed.infiniteQueryFilter({
          queue: "email-reminder",
        }),
      );
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      proxy.admin.jobs.listFailed.infiniteQueryFilter({ queue: "pdf-export" }),
    );
  });
});
