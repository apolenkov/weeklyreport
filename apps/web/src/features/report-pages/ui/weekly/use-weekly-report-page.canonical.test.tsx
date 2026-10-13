import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@weeklyreport/api/infrastructure/trpc/trpc.router";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { makeWeeklyReportFixture } from "../../../../test-utils/report-section-fixtures";
import { useWeeklyReportPage } from "./use-weekly-report-page";

const replace = vi.fn();
const searchParams = new URLSearchParams("scope=lead&mode=slides");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

function activeReport(reportId: string) {
  return {
    status: "active" as const,
    ...makeWeeklyReportFixture({ reportId }),
  };
}

describe("active report canonical entry", () => {
  it.each(["remount", "pinned-to-unpinned", "offline-remount"] as const)(
    "resolves the current active report before pinning a fresh cached ID on %s",
    async (entry) => {
      const reportA = activeReport("11111111-1111-4111-8111-111111111111");
      const reportB = activeReport("22222222-2222-4222-8222-222222222222");
      const freshResponse = Promise.withResolvers<typeof reportB>();
      const onlineBefore = onlineManager.isOnline();
      let activeResponse = Promise.resolve(reportA);
      const queryClient = makeQueryClient();
      const client = createTRPCClient<AppRouter>({
        links: [
          () =>
            ({ op }) =>
              observable((observer) => {
                if (op.path !== "weeklyReport.get") {
                  observer.error(new Error(`Unexpected request: ${op.path}`));
                  return;
                }
                const input = op.input as { reportId?: string };
                const response = input.reportId
                  ? Promise.resolve(reportA)
                  : activeResponse;
                void response.then((data) => {
                  observer.next({ result: { data } });
                  observer.complete();
                });
              }),
        ],
      });
      const proxy = createTRPCOptionsProxy<AppRouter>({
        client,
        queryClient,
      });
      function Providers({ children }: { readonly children: ReactNode }) {
        return (
          <QueryClientProvider client={queryClient}>
            <TRPCProxyContext.Provider value={proxy}>
              {children}
            </TRPCProxyContext.Provider>
          </QueryClientProvider>
        );
      }
      const params = {
        canonicalBasePath: "/head/report",
        scope: "product" as const,
        authorId: "author-1",
      };
      const firstVisit = renderHook(
        () => useWeeklyReportPage({ ...params, redirectToCanonical: false }),
        { wrapper: Providers },
      );
      await waitFor(() => expect(firstVisit.result.current.kind).toBe("ready"));
      firstVisit.unmount();
      // The admin now activates B while the same browser retains its fresh A cache.
      activeResponse = freshResponse.promise;
      if (entry === "offline-remount") onlineManager.setOnline(false);
      const returningVisit = renderHook(
        ({ reportId }: { reportId: string | undefined }) =>
          useWeeklyReportPage({
            ...params,
            reportId,
            redirectToCanonical: true,
          }),
        {
          wrapper: Providers,
          initialProps: {
            reportId:
              entry === "pinned-to-unpinned" ? reportA.reportId : undefined,
          },
        },
      );
      try {
        if (entry === "pinned-to-unpinned") {
          await waitFor(() =>
            expect(returningVisit.result.current.kind).toBe("ready"),
          );
          returningVisit.rerender({ reportId: undefined });
        }
        expect(replace).not.toHaveBeenCalled();
        // Retained content is available while resolution waits; it cannot pin A.
        expect(returningVisit.result.current.kind).toBe("ready");
        await act(async () => {
          onlineManager.setOnline(true);
          freshResponse.resolve(reportB);
          await freshResponse.promise;
        });
        await waitFor(() =>
          expect(replace).toHaveBeenCalledWith(
            "/head/report/22222222-2222-4222-8222-222222222222?authorId=author-1&mode=slides&scope=lead",
            { scroll: false },
          ),
        );
        expect(replace).not.toHaveBeenCalledWith(
          expect.stringContaining(reportA.reportId),
          expect.anything(),
        );
      } finally {
        returningVisit.unmount();
        queryClient.clear();
        onlineManager.setOnline(onlineBefore);
        freshResponse.resolve(reportB);
      }
    },
  );
});
