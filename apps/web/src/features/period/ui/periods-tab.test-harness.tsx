import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { PeriodListItem } from "@weeklyreport/shared";
import type { ReactNode } from "react";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { PeriodsTab } from "./periods-tab";

// ----- fixtures ------------------------------------------------------

export function makeRow(overrides: Partial<PeriodListItem>): PeriodListItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    periodStart: new Date("2026-05-04T00:00:00Z"),
    periodEnd: new Date("2026-05-10T23:59:59Z"),
    deadline: new Date("2026-05-09T18:00:00Z"),
    publishedAt: null,
    periodState: "open",
    periodStatus: "open",
    archived: false,
    autoPublished: false,
    autoArchived: false,
    submittedCount: 3,
    totalCount: 6,
    canReopen: false,
    canArchive: false,
    ...overrides,
  };
}

export const openRow = makeRow({
  id: "11111111-1111-4111-8111-111111111101",
  periodState: "open",
  periodStatus: "open",
});
export const publishedFresh = makeRow({
  id: "11111111-1111-4111-8111-111111111102",
  periodState: "published",
  periodStatus: "published",
  publishedAt: new Date(Date.now() - 2 * 3_600_000),
  submittedCount: 6,
  totalCount: 6,
  canReopen: true,
  canArchive: true,
});
export const publishedStale = makeRow({
  id: "11111111-1111-4111-8111-111111111103",
  periodState: "published",
  periodStatus: "published",
  publishedAt: new Date(Date.now() - 200 * 3_600_000),
  canReopen: false,
  canArchive: true,
});
export const archivedRow = makeRow({
  id: "11111111-1111-4111-8111-111111111104",
  periodState: "archived",
  periodStatus: "published",
  archived: true,
});

// ----- tRPC test double ----------------------------------------------

export function renderTab(args?: {
  active?: PeriodListItem[];
  archive?: PeriodListItem[];
  // Archive page by server input (cursor included); defaults to one page.
  archivePages?: (input: { cursor?: unknown }) => unknown;
  activeError?: boolean;
}) {
  const activeRows = args?.active ?? [openRow, publishedFresh, publishedStale];
  const archiveRows = args?.archive ?? [archivedRow];

  const { proxy, captured } = createMockTRPC([
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["reports", "getActive"] },
    { path: ["leadForm", "byPeriod"] },
    { path: ["leadForm", "statusOverview"] },
    { path: ["leadForm", "openWork"] },
    { path: ["reports", "myHistory"] },
    { path: ["reports", "compiledHistory"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "listReopenRequests"] },
    { path: ["admin", "pendingReopenCount"] },
    { path: ["admin", "getSettings"] },
    { path: ["admin", "getOrganization"] },
    {
      path: ["admin", "listPeriodsByState"],
      // The mock calls plain queries without input, so they are the active
      // bucket; the archive pages through infiniteQueryOptions with its input.
      query: (input?: { bucket?: string; cursor?: unknown }) => {
        if (input?.bucket !== "archive") {
          if (args?.activeError) throw new Error("boom");
          return { periods: activeRows, nextCursor: null };
        }
        return (
          args?.archivePages?.(input) ?? {
            periods: archiveRows,
            nextCursor: null,
          }
        );
      },
    },
    { path: ["admin", "archivePeriod"], mutation: true },
    { path: ["admin", "unarchivePeriod"], mutation: true },
    // admin.createPeriodManual mutation surface.
    { path: ["admin", "createPeriodManual"], mutation: true },
    // Edit-period mutation surface used by the row-level Edit icon.
    { path: ["admin", "updatePeriodManual"], mutation: true },
    // Delete period (draft/scheduled only).
    { path: ["admin", "deleteReport"], mutation: true },
    { path: ["period", "publish"], mutation: true },
    { path: ["period", "reopen"], mutation: true },
    { path: ["org", "getPublic"] },
    { path: ["auth", "me"] },
    { path: ["weeklyReport", "get"] },
  ]);

  // Seed default mock resolved values for mutation fns.
  expectDefined(captured["admin.archivePeriod"]).mutationFn.mockResolvedValue({
    success: true,
  });
  expectDefined(captured["admin.unarchivePeriod"]).mutationFn.mockResolvedValue(
    {
      success: true,
    },
  );
  expectDefined(captured["admin.deleteReport"]).mutationFn.mockResolvedValue({
    success: true,
  });
  // createPeriodManual server returns the new row's shape.
  expectDefined(
    captured["admin.createPeriodManual"],
  ).mutationFn.mockResolvedValue({
    periodId: "11111111-1111-4111-8111-111111111199",
    periodStart: new Date("2026-05-18T00:00:00Z"),
    periodEnd: new Date("2026-05-24T23:59:59Z"),
    deadline: new Date("2026-05-22T15:00:00Z"),
    periodState: "scheduled",
  });
  // updatePeriodManual server returns the updated row.
  expectDefined(
    captured["admin.updatePeriodManual"],
  ).mutationFn.mockResolvedValue({
    periodId: "11111111-1111-4111-8111-111111111102",
    periodStart: new Date("2026-05-04T00:00:00Z"),
    periodEnd: new Date("2026-05-10T23:59:59Z"),
    deadline: new Date("2026-05-09T18:00:00Z"),
    periodState: "published",
    weekLabel: null,
  });
  expectDefined(captured["period.publish"]).mutationFn.mockResolvedValue({
    success: true,
  });
  expectDefined(captured["period.reopen"]).mutationFn.mockResolvedValue({
    success: true,
  });

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

  const result = render(<PeriodsTab />, { wrapper: Wrapper });
  // qc + the mock proxy let a test wait for a specific query state before it
  // asserts on the rendered surface (an error may not be painted yet).
  return { ...result, captured, qc, trpc: proxy };
}
