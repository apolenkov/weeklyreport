import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { useLeadFormDraftOrchestration } from "./use-lead-form-draft-orchestration";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const ITEM_ID = "55555555-5555-4555-8555-555555555555";
const STABLE_ID = "66666666-6666-4666-8666-666666666666";

function makeSection(
  text: string,
  version = 1,
  id = ITEM_ID,
  stableId: string | undefined = STABLE_ID,
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead",
    version,
    status: "draft",
    submittedAt: null,
    projects: [
      { projectId: PROJECT_ID, projectName: "Project", trafficLight: "green" },
    ],
    items: [
      {
        id,
        stableId,
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text,
        tag: "general",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageIds: [],
      },
    ],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  } as ReportSectionReadModel;
}

function withItem(
  section: ReportSectionReadModel,
  patch: Partial<ReportSectionReadModel["items"][number]>,
): ReportSectionReadModel {
  return {
    ...section,
    items: section.items.map((item) => ({ ...item, ...patch })),
  };
}

/** Creates a controllable save response for round-trip timing tests. */
function createDeferredSection() {
  let resolve!: (section: ReportSectionReadModel) => void;
  const promise = new Promise<ReportSectionReadModel>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function renderOrchestration(
  initial: ReportSectionReadModel,
  mutationFn: (vars: unknown) => Promise<unknown> = () =>
    Promise.resolve(initial),
) {
  const calls: unknown[] = [];
  const refetchSection = vi.fn(() => Promise.resolve());
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "getActive"] },
    { path: ["reports", "myHistory"] },
    { path: ["leadForm", "byPeriod"] },
  ]);
  captured["reports.saveDraft"].mutationFn.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- React Query consumes the async mutation result; the mock type exposes a void callback
    async (vars) => {
      calls.push(vars);
      return mutationFn(vars);
    },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const rendered = renderHook(
    ({ serverSection }: { serverSection: ReportSectionReadModel }) =>
      useLeadFormDraftOrchestration({
        serverSection,
        sectionIdForActions: SECTION_ID,
        serverReadOnly: false,
        refetchSection,
      }),
    { wrapper: Wrapper, initialProps: { serverSection: initial } },
  );
  rendered.rerender({ serverSection: initial });
  return { ...rendered, calls, refetchSection };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("useLeadFormDraftOrchestration", () => {
  it("preserves keystrokes typed while the confirmed save refetches", async () => {
    const initial = makeSection("initial");
    const saved = makeSection("saved snapshot", 2);
    const deferred = createDeferredSection();
    const { result, rerender, calls } = renderOrchestration(
      initial,
      () => deferred.promise,
    );

    act(() =>
      result.current.setDraftSection(
        (current) => current && withItem(current, { text: "saved snapshot" }),
      ),
    );
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(calls).toHaveLength(1);
    act(() =>
      result.current.setDraftSection(
        (current) =>
          current && withItem(current, { text: "latest keystrokes" }),
      ),
    );
    await act(async () => {
      deferred.resolve(saved);
      await vi.advanceTimersByTimeAsync(0);
    });
    rerender({ serverSection: saved });

    expect(result.current.draftSection?.items[0]?.text).toBe(
      "latest keystrokes",
    );
    expect(result.current.versionRef.current).toBe(2);
  });

  it("reseeds a clean draft from an independent server edit", () => {
    const initial = makeSection("initial");
    const external = makeSection("external", 2);
    const { result, rerender } = renderOrchestration(initial);

    expect(result.current.autosave.dirty).toBe(false);
    rerender({ serverSection: external });

    expect(result.current.draftSection?.items[0]?.text).toBe("external");
  });

  it("surfaces the conflict path before loading an external dirty edit", () => {
    const initial = makeSection("initial");
    const external = makeSection("external", 2);
    const { result, rerender, refetchSection } = renderOrchestration(initial);
    act(() =>
      result.current.setDraftSection(
        (current) => current && withItem(current, { text: "local edit" }),
      ),
    );

    rerender({ serverSection: external });

    expect(refetchSection).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(result.current.draftSection?.items[0]?.text).toBe("external");
  });

  it("reconciles a server id while preserving newer local content", async () => {
    const initial = makeSection("initial");
    const tempId = "77777777-7777-4777-8777-777777777777";
    const realId = "88888888-8888-4888-8888-888888888888";
    const saved = makeSection("saved snapshot", 2, realId, STABLE_ID);
    const deferred = createDeferredSection();
    const { result, rerender } = renderOrchestration(
      initial,
      () => deferred.promise,
    );
    act(() =>
      result.current.setDraftSection(
        (current) =>
          current &&
          withItem(current, {
            id: tempId,
            stableId: undefined,
            text: "saved snapshot",
          }),
      ),
    );
    await act(() => vi.advanceTimersByTimeAsync(5000));
    act(() =>
      result.current.setDraftSection(
        (current) =>
          current && withItem(current, { text: "newer local content" }),
      ),
    );
    await act(async () => {
      deferred.resolve(saved);
      await vi.advanceTimersByTimeAsync(0);
    });
    rerender({ serverSection: saved });

    expect(result.current.draftSection?.items[0]).toMatchObject({
      id: realId,
      stableId: STABLE_ID,
      text: "newer local content",
    });
    expect(result.current.autosave.dirty).toBe(true);
  });

  it("keeps a rejected save dirty and surfaces the server error", async () => {
    const initial = makeSection("initial");
    const { result } = renderOrchestration(initial, () =>
      Promise.reject(new Error("Validation rejected")),
    );
    act(() =>
      result.current.setDraftSection(
        (current) => current && withItem(current, { text: "invalid edit" }),
      ),
    );

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(toast.error).toHaveBeenCalledWith("Validation rejected");
    expect(result.current.autosave.dirty).toBe(true);
  });
});
