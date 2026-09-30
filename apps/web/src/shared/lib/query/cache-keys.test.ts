import {
  QueryClient,
  type QueryKey,
  QueryObserver,
} from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeTRPCProxy } from "../trpc/trpc";
import {
  invalidateAdmin,
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
  invalidatePeriodLifecycle,
  invalidateReview,
  invalidateSubmissionDashboard,
} from "./cache-keys";

const routes = {
  dashboard: ["review.dashboard", "archive.list", "weeklyReport.get"],
  lead: ["reports.getActive", "leadForm.byPeriod"],
  history: ["reports.myHistory"],
};

const cases = [
  ["dashboard", invalidateDashboard, routes.dashboard],
  ["lead form", invalidateLeadForm, routes.lead],
  ["lead history", invalidateLeadHistory, routes.history],
  [
    "period lifecycle",
    invalidatePeriodLifecycle,
    [
      ...routes.dashboard,
      ...routes.lead,
      ...routes.history,
      "leadForm.statusOverview",
      "leadForm.openWork",
      "reports.compiledHistory",
      "admin.listPeriodsByState",
      "admin.snapshot",
      "admin.listReopenRequests",
      "admin.pendingReopenCount",
    ],
  ],
  [
    "submission",
    invalidateSubmissionDashboard,
    [...routes.dashboard, "activity.live"],
  ],
  [
    "admin",
    invalidateAdmin,
    [
      "admin.snapshot",
      "admin.getSettings",
      "admin.getOrganization",
      "org.getPublic",
      "auth.me",
      "weeklyReport.get",
    ],
  ],
  [
    "review",
    invalidateReview,
    [
      "weeklyReport.get",
      "leadForm.byPeriod",
      "reports.getActive",
      "review.dashboard",
      "activity.live",
    ],
  ],
] as const;

describe("cache-keys helpers with the real tRPC proxy", () => {
  it.each(cases)(
    "%s invalidates exactly its query families",
    (_name, invalidate, paths) => {
      const client = new QueryClient();
      const spy = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
      invalidate(client, makeTRPCProxy(client));
      expect(spy.mock.calls.map(([filter]) => filter)).toEqual(
        paths.map((path) => ({ queryKey: [path.split(".")] })),
      );
      client.clear();
    },
  );

  it("marks every history and period-list variant stale without touching settings or organization", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000 } },
    });
    const trpc = makeTRPCProxy(client);
    const keys: QueryKey[] = [
      ...[false, true].map((includeArchive) =>
        trpc.reports.compiledHistory.queryKey({ includeArchive }),
      ),
      ...[25, 50].map((limit) =>
        trpc.reports.myHistory.infiniteQueryKey({ limit }),
      ),
      ...(["active", "archive"] as const).map((bucket) =>
        trpc.admin.listPeriodsByState.queryKey({ bucket }),
      ),
      trpc.admin.snapshot.queryKey(),
      trpc.admin.pendingReopenCount.queryKey(),
      trpc.admin.listReopenRequests.infiniteQueryKey({ status: "pending" }),
      trpc.leadForm.statusOverview.queryKey({ reportId: "report-a" }),
      trpc.leadForm.openWork.infiniteQueryKey({
        reportId: "report-a",
        limit: 25,
      }),
    ];
    const unrelated: QueryKey[] = [
      trpc.admin.getSettings.queryKey(),
      trpc.admin.getOrganization.queryKey(),
      trpc.org.getPublic.queryKey(),
    ];
    for (const key of [...keys, ...unrelated])
      client.setQueryData(key, "cached");
    invalidatePeriodLifecycle(client, trpc);
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      keys.map(() => true),
    );
    expect(
      unrelated.map((key) => client.getQueryState(key)?.isInvalidated),
    ).toEqual(unrelated.map(() => false));
    client.clear();
  });

  it.each(["compiledHistory", "statusOverview", "openWork"] as const)(
    "refetches an observed %s through its real query key",
    async (projection) => {
      const client = new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: false } },
      });
      const trpc = makeTRPCProxy(client);
      const projectionKeys = {
        compiledHistory: trpc.reports.compiledHistory.queryKey({
          includeArchive: true,
        }),
        statusOverview: trpc.leadForm.statusOverview.queryKey({
          reportId: "report-a",
        }),
        openWork: trpc.leadForm.openWork.infiniteQueryKey({
          reportId: "report-a",
          limit: 25,
        }),
      };
      const queryKey: QueryKey = projectionKeys[projection];
      client.setQueryData(queryKey, "before mutation");
      const queryFn = vi.fn().mockResolvedValue("after mutation");
      const observer = new QueryObserver(client, { queryKey, queryFn });
      const unsubscribe = observer.subscribe(() => undefined);
      try {
        expect(queryFn).not.toHaveBeenCalled();
        invalidatePeriodLifecycle(client, trpc);
        await waitFor(() =>
          expect(client.getQueryData(queryKey)).toBe("after mutation"),
        );
        expect(queryFn).toHaveBeenCalledTimes(1);
      } finally {
        unsubscribe();
        client.clear();
      }
    },
  );

  it("handles rejected invalidations without an unhandled rejection", async () => {
    const client = new QueryClient();
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(client, "invalidateQueries").mockRejectedValue(
      new Error("invalidate failed"),
    );
    const unhandledRejection = vi.fn();
    window.addEventListener("unhandledrejection", unhandledRejection);
    try {
      invalidateDashboard(client, makeTRPCProxy(client));
      await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(3));
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        "[cache-keys] invalidateQueries failed",
        expect.any(Error),
      );
    } finally {
      window.removeEventListener("unhandledrejection", unhandledRejection);
      client.clear();
    }
  });
});
