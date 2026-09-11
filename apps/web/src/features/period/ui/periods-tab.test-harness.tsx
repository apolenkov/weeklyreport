import type { PeriodListItem } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
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
    { path: ["admin", "getSettings"] },
    { path: ["admin", "getOrganization"] },
    {
      path: ["admin", "listPeriodsByState"],
      // Input-parameterized: active vs archive caches stay independent.
      queryByInput: (input: unknown) => {
        const { bucket } = input as { bucket: string };
        if (bucket === "active" && args?.activeError) {
          throw new Error("boom");
        }
        return bucket === "archive" ? archiveRows : activeRows;
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
  return { ...result, captured };
}
