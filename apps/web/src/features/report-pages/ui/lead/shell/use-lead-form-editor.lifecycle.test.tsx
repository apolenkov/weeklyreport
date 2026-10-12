import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type UserSession, userSessionSchema } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import {
  SessionContext,
  SessionProvider,
} from "../../../../../shared/lib/auth/session-provider";
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

function buildWrapper(
  options: { client?: QueryClient; viewer?: { current: UserSession } } = {},
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

it.each(["head", "admin"] as const)(
  "suspends real editor autosave on auth.me role-away to %s and still recognizes local edits",
  async (role) => {
    const viewer = {
      current: userSessionSchema.parse({
        userId: AUTHOR_ID,
        email: "synthetic@example.test",
        name: "Synthetic Lead",
        lastName: "Lead",
        firstName: "Synthetic",
        middleName: null,
        role: "lead",
        activeReportId: REPORT_ID,
        activeReportSectionId: SECTION_ID,
        reportingGroupName: "Synthetic Group",
      }),
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const writePort = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.reject(new Error("Unexpected role-away write")),
      submit: () => Promise.reject(new Error("Unexpected submit")),
    });
    const { result, unmount } = renderHook(
      () => useLeadFormEditorWithPort({ reportId: REPORT_ID }, writePort),
      { wrapper: buildWrapper({ client, viewer }) },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const editor = result.current;
    if (editor.status !== "ready") throw new Error("Expected ready editor");
    vi.useFakeTimers();
    act(() => editor.draft.quickAdd("current"));
    const staged = result.current;
    if (staged.status !== "ready") throw new Error("Expected staged editor");
    act(() =>
      staged.draft.quickAddSave({
        id: "66666666-6666-4666-8666-666666666666",
        parent: { kind: "product", id: PROJECT_ID },
        productId: PROJECT_ID,
        productName: "Test Product",
        activityId: null,
        status: "in-progress",
        text: "Locally authored row",
        author: "Synthetic Lead",
        priorityRank: null,
        stageNames: ["Development"],
      }),
    );
    expect(
      result.current.status === "ready" && result.current.draft.dirty,
    ).toBe(true);
    try {
      viewer.current = userSessionSchema.parse({ ...viewer.current, role });
      await act(async () => {
        client.setQueryData([["auth", "me"]], viewer.current);
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.status).toBe("loading");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(writePort.calls.saveDraft).toHaveLength(0);
      const latest = {
        ...makeSection(2),
        projects: makeSection().projects.map((project) => ({
          ...project,
          trafficLight: "red" as const,
        })),
      };
      await act(async () => {
        client.setQueryData([["leadForm", "byPeriod"]], {
          section: latest,
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("changed elsewhere"),
      );
      expect(writePort.calls.saveDraft).toHaveLength(0);
    } finally {
      unmount();
      client.clear();
      vi.useRealTimers();
    }
  },
);
