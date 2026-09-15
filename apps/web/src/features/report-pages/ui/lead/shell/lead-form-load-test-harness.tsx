import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";

export function buildLeadLoadHarness(
  opts: {
    byPeriodQueryFn?: (input: unknown) => unknown;
    activeQueryFn?: () => unknown;
    historyQueryFn?: () => unknown;
  } = {},
) {
  const section = makeReportSectionFixture();
  const activeQuery = vi.fn(opts.activeQueryFn ?? (() => section));
  const historyQuery = vi.fn(
    opts.historyQueryFn ?? (() => ({ items: [], nextCursor: null })),
  );
  const sectionQuery = vi.fn(
    opts.byPeriodQueryFn ??
      (() => ({
        section,
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      })),
  );
  const { proxy } = createMockTRPC([
    {
      path: ["ai", "availability"],
      query: { availability: "not_configured" },
    },
    {
      path: ["reports", "getActive"],
      query: activeQuery,
    },
    { path: ["reports", "myHistory"], query: historyQuery },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: sectionQuery,
    },
    {
      path: ["leadForm", "statusOverview"],
      query: {
        current: {
          reportId: section.reportId,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section,
        },
        predecessor: { availability: "unavailable", reason: "no_predecessor" },
      },
    },
    {
      path: ["leadForm", "openWork"],
      query: { occurrences: [], nextCursor: null },
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          <SessionContext.Provider
            value={{
              user: {
                id: "test-lead",
                name: "Test Lead",
                email: "lead@example.test",
                role: "lead",
              },
              organization: null,
              isLoading: false,
              isAuthenticated: true,
            }}
          >
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          </SessionContext.Provider>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return {
    Wrapper,
    queryClient,
    section,
    activeQuery,
    historyQuery,
    sectionQuery,
  };
}
