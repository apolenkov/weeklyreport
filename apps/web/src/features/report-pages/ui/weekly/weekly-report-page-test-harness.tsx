import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  SessionContext,
  type SessionState,
  type SessionUser,
} from "../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import {
  type CapturedMutation,
  createMockTRPC,
  type ProcedureDescriptor,
} from "../../../../test-utils/mock-trpc";
import {
  makeWeeklyReportData,
  type WeeklyReportData,
} from "./__tests__/weekly-report-page-harness";
import { WeeklyReportPage } from "./weekly-report-page";

export type WeeklyReportPageOptions = Readonly<{
  readonly authorId?: string;
  readonly role?: SessionUser["role"];
  readonly scope?: "product" | "lead";
  readonly documentActionsLeading?: ReactNode;
  readonly contextControls?: ReactNode;
  readonly contextControlsLeading?: ReactNode;
}>;

export type WeeklyReportPageRender = ReturnType<typeof render> & {
  readonly captured: Record<string, CapturedMutation>;
};

const descriptorsFor = (
  data: WeeklyReportData,
): readonly ProcedureDescriptor[] => [
  { path: ["weeklyReport", "get"], query: data },
  { path: ["period", "publish"], mutation: true },
  { path: ["period", "reopen"], mutation: true },
  { path: ["pdfExport", "request"], mutation: true },
  { path: ["pdfExport", "status"], query: null },
  { path: ["review", "dashboard"] },
  { path: ["review", "verdict"], mutation: true },
  { path: ["review", "comment"], mutation: true },
  { path: ["review", "deleteComment"], mutation: true },
  { path: ["review", "acknowledgements"], queryByInput: () => [] },
  { path: ["review", "acknowledge"], mutation: true },
  { path: ["archive", "list"] },
  { path: ["archive", "archiveReport"], mutation: true },
  { path: ["archive", "unarchiveReport"], mutation: true },
  { path: ["reports", "myHistory"] },
  { path: ["reports", "getActive"] },
  { path: ["leadForm", "byPeriod"] },
  { path: ["leadForm", "versions"] },
  { path: ["admin", "snapshot"] },
  { path: ["admin", "getSettings"] },
];

const queryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const sessionStateFor = (role: SessionUser["role"]): SessionState => ({
  user: {
    id: "head-user-id",
    name: "Test User",
    email: "test.user@example.com",
    role,
  },
  organization: null,
  isLoading: false,
  isAuthenticated: true,
});

const providersFor = (
  proxy: ReturnType<typeof createMockTRPC>["proxy"],
  client: QueryClient,
  role: SessionUser["role"],
) => {
  const sessionState = sessionStateFor(role);
  return function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={sessionState}>
          <TRPCProxyContext.Provider value={proxy}>
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  };
};

export function renderWeeklyReportPage(
  data: ReturnType<typeof makeWeeklyReportData>,
  options: WeeklyReportPageOptions = {},
): WeeklyReportPageRender {
  const { proxy, captured } = createMockTRPC([...descriptorsFor(data)]);
  const renderResult = render(
    <WeeklyReportPage
      authorId={options.authorId}
      scope={options.scope}
      documentActionsLeading={options.documentActionsLeading}
      contextControls={options.contextControls}
      contextControlsLeading={options.contextControlsLeading}
    />,
    { wrapper: providersFor(proxy, queryClient(), options.role ?? "head") },
  );
  return { ...renderResult, captured };
}
