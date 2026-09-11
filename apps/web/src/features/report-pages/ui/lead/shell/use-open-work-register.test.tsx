import type { LeadOpenWorkHistoryOccurrence } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { useOpenWorkRegister } from "./use-open-work-register";

const TARGET_REPORT_ID = "40000000-0000-4000-8000-000000000001";
const SOURCE_REPORT_ID = "40000000-0000-4000-8000-000000000002";
const SECTION_ID = "40000000-0000-4000-8000-000000000003";
const PROJECT_ID = "40000000-0000-4000-8000-000000000004";
const STABLE_ID = "40000000-0000-4000-8000-000000000005";

function occurrence(): LeadOpenWorkHistoryOccurrence {
  return {
    source: "published",
    reportId: SOURCE_REPORT_ID,
    reportSectionId: SECTION_ID,
    periodStart: new Date("2026-07-06T00:00:00.000Z"),
    periodEnd: new Date("2026-07-12T00:00:00.000Z"),
    parent: { kind: "product", id: PROJECT_ID, name: "Payments" },
    item: {
      id: "40000000-0000-4000-8000-000000000006",
      stableId: STABLE_ID,
      projectId: PROJECT_ID,
      activityId: null,
      type: "current",
      text: "Resume settlement rollout",
      tag: "delivery",
      workflowStatus: "paused",
      carriedOver: false,
      pausedReason: "Waiting for the provider",
      stageNames: ["Development"],
    },
  };
}

describe("useOpenWorkRegister", () => {
  it("automatically exhausts every cursor page before declaring completeness", async () => {
    const query = vi.fn((input: unknown) => {
      const cursor = (input as { readonly cursor?: string }).cursor;
      return cursor
        ? { occurrences: [occurrence()], nextCursor: null }
        : { occurrences: [], nextCursor: "older-page" };
    });
    const { proxy } = createMockTRPC([
      { path: ["leadForm", "openWork"], query },
    ]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => useOpenWorkRegister(TARGET_REPORT_ID, []),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isComplete).toBe(true));
    expect(query).toHaveBeenCalledTimes(2);
    expect(result.current.openItems).toHaveLength(1);
    expect(result.current.openItems[0]?.occurrence.item.stableId).toBe(
      STABLE_ID,
    );
    expect(result.current.terminalItems).toEqual([]);
  });
});
