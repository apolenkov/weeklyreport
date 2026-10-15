import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { logClientError } from "../../../../../shared/lib/errors/client-error-reporting";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock(
  "../../../../../shared/lib/errors/client-error-reporting",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../../shared/lib/errors/client-error-reporting")
    >()),
    logClientError: vi.fn(),
  }),
);

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";

// queryByInput resolves its factory's value, so a never-settling promise keeps
// the report-scoped reads loading while the active-report read fails.
const never = () => new Promise<never>(() => undefined);

function renderOverviewWithFailingActiveReport() {
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: () => {
        throw new Error("Active report unavailable");
      },
    },
    { path: ["leadForm", "statusOverview"], queryByInput: () => never() },
    { path: ["leadForm", "openWork"], query: "pending" },
    { path: ["leadForm", "byPeriod"], queryByInput: () => never() },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    { path: ["ai", "availability"], query: { availability: "unavailable" } },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
  ]);
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TRPCProxyContext.Provider value={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: "a0000000-0000-4000-8000-000000000099",
              name: "Test Lead",
              email: "lead@example.test",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <LeadReportAssistantStore>
            <LeadForm reportId={REPORT_ID} mode="overview" />
          </LeadReportAssistantStore>
        </SessionContext.Provider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
}

describe("LeadForm Overview — active report failure", () => {
  it("reports one failed active-report load once across its query owners", async () => {
    renderOverviewWithFailingActiveReport();

    const activeReportLogs = () =>
      vi
        .mocked(logClientError)
        .mock.calls.filter(
          ([, , context]) => context?.procedure === "reports.getActive",
        );
    await waitFor(() => {
      expect(activeReportLogs().length).toBeGreaterThan(0);
    });
    // Let any second owner's effect run before counting.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(activeReportLogs()).toHaveLength(1);
    expect(
      vi
        .mocked(toast.error)
        .mock.calls.filter(
          ([message]) =>
            typeof message === "string" &&
            message.startsWith("Failed to load active report"),
        ),
    ).toHaveLength(1);
  });
});
