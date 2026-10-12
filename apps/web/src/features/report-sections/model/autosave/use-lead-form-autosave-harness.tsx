import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import type { ReactNode } from "react";

import { invalidateLeadForm } from "../../../../shared/lib/query/cache-keys";
import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { InMemoryLeadFormWriteAdapter } from "../lead-form/lead-form-write-port.in-memory";

export const AUTOSAVE_SECTION_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";

export function makeAutosavePayload(text = "first"): DraftSavePayload {
  return {
    reportSectionId: AUTOSAVE_SECTION_ID,
    // The hook replaces this with its live version at mutate time.
    version: 1,
    status: "draft",
    projectStatuses: [{ projectId: PROJECT_ID, status: "green" }],
    stageStatuses: [],
    activityStatuses: [],
    items: [
      {
        projectId: PROJECT_ID,
        type: "current",
        text,
        tag: "tag",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
    ],
    risks: [],
    decisions: [],
  };
}

export function makeAutosavePayloadFor(
  sectionId: string,
  text: string,
): DraftSavePayload {
  return { ...makeAutosavePayload(text), reportSectionId: sectionId };
}

export function makeAutosaveResponse(
  request: DraftSavePayload,
  version = request.version + 1,
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: request.reportSectionId,
    version,
  });
}

export function buildAutosaveHarness(
  opts: {
    mutationFn?: (vars: DraftSavePayload) => Promise<ReportSectionReadModel>;
  } = {},
) {
  const calls: DraftSavePayload[] = [];
  const userMutationFn =
    opts.mutationFn ??
    ((request: DraftSavePayload) =>
      Promise.resolve(makeAutosaveResponse(request)));
  const { proxy } = createMockTRPC([
    { path: ["reports", "getActive"] },
    { path: ["reports", "myHistory"] },
    { path: ["leadForm", "byPeriod"] },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: async (input) => {
      calls.push(input);
      const saved = await userMutationFn(input);
      invalidateLeadForm(queryClient, proxy);
      return saved;
    },
    submit: () => Promise.reject(new Error("Unexpected submit")),
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { wrapper, calls, queryClient, writePort };
}
