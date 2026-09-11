import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { useDashboardData } from "./use-dashboard-data";
import { DASHBOARD_LOAD_STALL_MS } from "./use-dashboard-query-recovery";

vi.mock("../../../shared/lib/errors/client-error-reporting", () => ({
  logClientError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const cases = [
  ["review.dashboard", "reviewQ", "reviewRecovery"],
  ["weeklyReport.get", "weeklyQ", "weeklyRecovery"],
  ["activity.live", "activityQ", "activityRecovery"],
] as const;
const responses = {
  "review.dashboard": [],
  "weeklyReport.get": { status: "no-period", report: null },
  "activity.live": { reportId: null, periodStatus: null, rows: [] },
};
function response(data: unknown) {
  return new Response(JSON.stringify([{ result: { data: { json: data } } }]), {
    headers: { "content-type": "application/json" },
  });
}
function requestPath(input: RequestInfo | URL) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return new URL(url, "http://localhost").pathname.replace("/trpc/", "");
}

it.each(cases)(
  "restarts only stalled %s for every recovery trigger",
  async (path, queryName, recoveryName) => {
    for (const trigger of ["retry", "timeout", "history"] as const) {
      vi.useFakeTimers();
      const first = Promise.withResolvers<Response>();
      const calls = new Map<string, number>();
      vi.stubGlobal(
        "fetch",
        vi.fn((input: RequestInfo | URL) => {
          const requested = requestPath(input);
          const count = (calls.get(requested) ?? 0) + 1;
          calls.set(requested, count);
          if (requested === path && count === 1) return first.promise;
          if (!(requested in responses))
            throw new Error(`Unexpected query ${requested}`);
          const entry = Object.entries(responses).find(
            ([key]) => key === requested,
          );
          return Promise.resolve(response(entry?.[1]));
        }),
      );
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const cancel = vi.spyOn(client, "cancelQueries");
      const proxy = makeTRPCProxy(client);
      const keys = {
        "review.dashboard": proxy.review.dashboard.queryKey(),
        "weeklyReport.get": proxy.weeklyReport.get.queryKey({}),
        "activity.live": proxy.activity.live.queryKey(),
      };
      function Wrapper({ children }: { readonly children: ReactNode }) {
        return (
          <QueryClientProvider client={client}>
            <TRPCProxyContext.Provider value={proxy}>
              {children}
            </TRPCProxyContext.Provider>
          </QueryClientProvider>
        );
      }
      const h = renderHook(() => useDashboardData(), { wrapper: Wrapper });
      try {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5);
        });
        expect(calls.get(path), trigger).toBe(1);
        expect(h.result.current[queryName].data).toBeUndefined();
        await act(async () => {
          if (trigger === "retry") h.result.current[recoveryName].retry();
          if (trigger === "timeout")
            await vi.advanceTimersByTimeAsync(DASHBOARD_LOAD_STALL_MS);
          if (trigger === "history")
            window.dispatchEvent(
              new PageTransitionEvent("pageshow", { persisted: true }),
            );
          await vi.advanceTimersByTimeAsync(5);
        });
        expect(calls.get(path), trigger).toBe(2);
        expect(h.result.current[queryName].data).toEqual(responses[path]);
        expect(cancel).toHaveBeenCalledExactlyOnceWith({
          queryKey: keys[path],
          exact: true,
        });
        for (const [sibling, siblingQuery] of cases) {
          if (sibling === path) continue;
          expect(calls.get(sibling)).toBe(1);
          expect(h.result.current[siblingQuery].data).toEqual(
            responses[sibling],
          );
        }
        first.resolve(response({ stale: true }));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5);
        });
        expect(h.result.current[queryName].data).toEqual(responses[path]);
        expect(h.result.current[recoveryName].stalled).toBe(false);
      } finally {
        h.unmount();
        client.clear();
        first.resolve(response({ stale: true }));
        vi.useRealTimers();
      }
    }
  },
);
