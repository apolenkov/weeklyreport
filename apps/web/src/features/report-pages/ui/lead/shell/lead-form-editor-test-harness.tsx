import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReportSectionReadModel, UserSession } from "@weeklyreport/shared";
import type { ReactNode } from "react";

import {
  SessionContext,
  SessionProvider,
} from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";

export const SECTION_ID = "11111111-1111-4111-8111-111111111111";
export const REPORT_ID = "22222222-2222-4222-8222-222222222222";
export const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
export const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STAGE_ID = "55555555-5555-4555-8555-555555555555";

export function makeSection(
  version = 1,
  status: "draft" | "submitted" = "draft",
) {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    version,
    status,
    submittedAt: status === "submitted" ? new Date() : null,
    late: false,
    reviews: [],
    referencedProjects: [],
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        ownerGroupId: null,
        trafficLight: "green" as const,
        ownedStages: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 1 },
        ],
        stageSet: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 1 },
        ],
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  };
}

export function buildWrapper(
  options: {
    client?: QueryClient;
    viewer?: { current: UserSession };
    section?: () => ReportSectionReadModel;
  } = {},
) {
  const { proxy } = createMockTRPC([
    { path: ["auth", "me"], query: () => options.viewer?.current ?? null },
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
        authorRole: "lead" as const,
      },
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "byPeriod"],
      query: () => ({
        section: options.section?.() ?? makeSection(),
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
  ]);
  const queryClient =
    options.client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {options.viewer ? (
            <SessionProvider>
              <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
            </SessionProvider>
          ) : (
            <SessionContext.Provider
              value={{
                user: {
                  id: AUTHOR_ID,
                  name: "Test Lead",
                  email: "lead@example.com",
                  role: "lead",
                },
                organization: null,
                isLoading: false,
                isAuthenticated: true,
              }}
            >
              <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
            </SessionContext.Provider>
          )}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  };
}
