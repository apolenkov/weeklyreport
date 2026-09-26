// @vitest-environment jsdom
//
// Recovery retry through the real tRPC transport: the wire request must carry
// {jobId, expectedGeneration} and the settle must re-list the DB rows.

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { PdfRecoverySection } from "./pdf-recovery-section";

const JOB_ID = "de305d54-75b4-431b-adb2-eb6b9e546014";
const RECOVERY_ROW = {
  jobId: JOB_ID,
  reportId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  generation: 2,
  requestedBy: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  status: "recovery_required",
  createdAt: "2026-05-01T09:00:00.000Z",
};

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

// httpBatchLink can join same-tick procedures into one comma-separated path;
// answer each segment in order.
function trpcBatchResponse(results: unknown[]): Response {
  return new Response(
    JSON.stringify(
      results.map((data) => ({ result: { data: { json: data } } })),
    ),
    {
      headers: { "content-type": "application/json" },
      status: 200,
    },
  );
}

// Batched tRPC POST bodies are keyed by call index: {"0": {json: input}}.
function postedInputs(body: unknown): unknown[] {
  if (typeof body !== "string") return [];
  const parsed = JSON.parse(body) as Record<string, { json?: unknown }>;
  return Object.values(parsed).map((entry) => entry.json ?? entry);
}

describe("PdfRecoverySection — real transport retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts {jobId, expectedGeneration} and re-lists on settle", async () => {
    const requestPaths: string[] = [];
    const mutationBodies: unknown[] = [];
    let recoveryListed = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const paths = requestPath(input).split(",");
        requestPaths.push(...paths);
        if (init?.body !== undefined) {
          mutationBodies.push(...postedInputs(init.body));
        }
        const results = paths.map((path) => {
          if (path === "admin.jobs.listPdfRecovery") {
            return { jobs: recoveryListed ? [RECOVERY_ROW] : [] };
          }
          if (path === "admin.jobs.retryPdfRecovery") {
            return { jobId: JOB_ID, outcome: "retried" };
          }
          throw new Error(`Unexpected tRPC request: ${path}`);
        });
        return Promise.resolve(trpcBatchResponse(results));
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
    render(<PdfRecoverySection />, { wrapper: Wrapper });

    const row = await screen.findByTestId(`pdf-recovery-row-${JOB_ID}`);
    expect(row).toBeInTheDocument();

    recoveryListed = false;
    await userEvent.click(
      screen.getByRole("button", { name: `Retry PDF export ${JOB_ID}` }),
    );

    await waitFor(() => {
      expect(mutationBodies).toContainEqual({
        jobId: JOB_ID,
        expectedGeneration: 2,
      });
    });
    await waitFor(() => {
      expect(
        requestPaths.filter((path) => path === "admin.jobs.listPdfRecovery"),
      ).toHaveLength(2);
    });
    await waitFor(() =>
      expect(screen.queryByTestId(`pdf-recovery-row-${JOB_ID}`)).toBeNull(),
    );
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
