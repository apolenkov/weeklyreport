import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadFormWriteError } from "../../../../report-sections/model/lead-form/lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "../../../../report-sections/model/lead-form/lead-form-write-port.in-memory";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { useLeadFormEditorWithPort } from "./use-lead-form-editor";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STAGE_ID = "55555555-5555-4555-8555-555555555555";

function makeSection(version = 1, status: "draft" | "submitted" = "draft") {
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

function buildWrapper() {
  const { proxy } = createMockTRPC([
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
        section: makeSection(),
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
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
          <TRPCProxyContext.Provider value={proxy}>
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe("LeadFormEditorHandle lifecycle", () => {
  it("drives quick-add, save, conflict, and submit through one interface", async () => {
    let submitAttempt = 0;
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.resolve(makeSection(2)),
      submit: () => {
        submitAttempt += 1;
        return submitAttempt === 1
          ? Promise.reject(new LeadFormWriteError("conflict", "stale"))
          : Promise.resolve(makeSection(3, "submitted"));
      },
    });
    const { result } = renderHook(
      () => useLeadFormEditorWithPort({}, writePort),
      { wrapper: buildWrapper() },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ready = () => {
      const current = result.current;
      if (current.status !== "ready") throw new Error("editor not ready");
      return current;
    };

    act(() => ready().draft.quickAdd("current"));
    act(() =>
      ready().draft.quickAddSave({
        id: "66666666-6666-4666-8666-666666666666",
        parent: { kind: "product", id: PROJECT_ID },
        productId: PROJECT_ID,
        productName: "Test Product",
        activityId: null,
        status: "in-progress",
        text: "Added through the editor handle",
        author: "Test Lead",
        priorityRank: null,
        stageNames: ["Development"],
      }),
    );
    await waitFor(() => {
      if (result.current.status !== "ready")
        throw new Error("editor not ready");
      expect(result.current.draft.section.items).toHaveLength(1);
    });

    await act(() => ready().draft.save());
    expect(writePort.calls.saveDraft).toHaveLength(1);

    await expect(ready().draft.submit()).resolves.toBe("conflict");
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("changed elsewhere"),
    );

    await expect(ready().draft.submit()).resolves.toBe("submitted");
    expect(writePort.calls.submit).toHaveLength(2);
  });
});
