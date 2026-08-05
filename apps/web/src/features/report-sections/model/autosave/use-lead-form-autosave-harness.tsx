import type { DraftSavePayload } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";

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

export function buildAutosaveHarness(
  opts: { mutationFn?: (vars: unknown) => Promise<unknown> } = {},
) {
  const calls: unknown[] = [];
  const userMutationFn =
    opts.mutationFn ?? (() => Promise.resolve({ version: 2 }));
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "getActive"] },
    { path: ["reports", "myHistory"] },
    { path: ["leadForm", "byPeriod"] },
  ]);

  expectDefined(captured["reports.saveDraft"]).mutationFn.mockImplementation(
    async (vars: unknown) => {
      calls.push(vars);
      return userMutationFn(vars);
    },
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

  return { wrapper, calls, queryClient };
}
