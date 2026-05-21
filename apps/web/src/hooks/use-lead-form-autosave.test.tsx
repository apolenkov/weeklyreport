import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { useLeadFormAutosave } from "./use-lead-form-autosave";
import { TRPCProxyContext } from "../lib/trpc-context";

import type { DraftSavePayload } from "@customreport/shared";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const SECTION_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";

function makePayload(text = "first"): DraftSavePayload {
  return {
    reportSectionId: SECTION_ID,
    status: "draft",
    projectStatuses: [{ projectId: PROJECT_ID, status: "green" }],
    items: [
      {
        projectId: PROJECT_ID,
        type: "current",
        text,
        tag: "tag",
        workflowStatus: "in_progress",
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [],
  };
}

/**
 * Flush any pending microtasks under fake timers. React Query's mutation
 * machinery resolves through several Promise.resolve() ticks before
 * onSuccess/onError fire and React commits state.
 */
async function flushAll() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function buildHarness(
  opts: {
    mutationFn?: (vars: unknown) => Promise<unknown>;
  } = {},
) {
  const calls: unknown[] = [];
  const userMutationFn =
    opts.mutationFn ??
    (async () => {
      return { ok: true };
    });

  // The TRPCProxy mock: mutationOptions returns whatever the caller passes
  // PLUS our mutationFn. React Query will use this.mutationFn to execute.
  const trpcMock = {
    reports: {
      saveDraft: {
        mutationOptions: (passed: object) => ({
          ...passed,
          mutationFn: async (vars: unknown) => {
            calls.push(vars);
            return userMutationFn(vars);
          },
        }),
        pathFilter: () => ({ queryKey: ["reports", "saveDraft"] }),
      },
      getActive: { pathFilter: () => ({ queryKey: ["reports", "getActive"] }) },
      myHistory: { pathFilter: () => ({ queryKey: ["reports", "myHistory"] }) },
    },
    leadForm: {
      byPeriod: { pathFilter: () => ({ queryKey: ["leadForm", "byPeriod"] }) },
      versions: { pathFilter: () => ({ queryKey: ["leadForm", "versions"] }) },
    },
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { wrapper, calls, queryClient };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLeadFormAutosave", () => {
  it("starts idle with no payload, transitions to pending then saving", async () => {
    const { wrapper, calls } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: null as DraftSavePayload | null } },
    );

    expect(result.current.state).toBe("idle");
    expect(result.current.dirty).toBe(false);

    rerender({ payload: makePayload("first") });

    // Pending immediately on first dirty change.
    expect(result.current.state).toBe("pending");
    expect(result.current.dirty).toBe(true);
    expect(calls).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushAll();
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(["saving", "saved"]).toContain(result.current.state);
  });

  it("coalesces two rapid changes within the debounce window into a single mutation call", async () => {
    const { wrapper, calls } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: makePayload("a") } },
    );

    expect(result.current.state).toBe("pending");

    // 1000ms in, change again -> debounce restarts.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ payload: makePayload("b") });

    // 1000ms more (2s total since first change, 1s since second).
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(calls).toHaveLength(0);

    // 2000ms more — second debounce expires.
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushAll();
    });

    expect(calls.length).toBe(1);
  });

  it('sets state="saved" and lastSavedAt to a Date after success', async () => {
    const { wrapper } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("hello"),
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushAll();
    });

    expect(result.current.state).toBe("saved");
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it("does not fire a mutation when payload deep-equals the previously saved payload", async () => {
    const { wrapper, calls } = buildHarness();
    const initial = makePayload("same");
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: initial } },
    );

    // First save completes.
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushAll();
    });

    expect(result.current.state).toBe("saved");
    expect(calls.length).toBe(1);

    // Pass an equivalent (new reference, identical content) payload.
    rerender({ payload: makePayload("same") });

    // dirty must be false; no new pending transition.
    expect(result.current.dirty).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushAll();
    });
    expect(calls.length).toBe(1);
  });

  it("does not autosave when enabled=false (e.g. read-only or submitted)", async () => {
    const { wrapper, calls } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("locked"),
          enabled: false,
          debounceMs: 3000,
        }),
      { wrapper },
    );

    expect(result.current.dirty).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await flushAll();
    });
    expect(calls).toHaveLength(0);
    expect(result.current.state).toBe("idle");
  });

  it('on mutation error transitions to state="error" and calls toast.error', async () => {
    const { wrapper } = buildHarness({
      mutationFn: async () => {
        throw new Error("Network down");
      },
    });
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("boom"),
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushAll();
    });

    expect(result.current.state).toBe("error");
    expect(toast.error).toHaveBeenCalledWith("Network down");
  });

  it("exposes dirty=true while a change is pending and dirty=false after success", async () => {
    const { wrapper } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: null as DraftSavePayload | null } },
    );

    expect(result.current.dirty).toBe(false);

    rerender({ payload: makePayload("dirty") });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushAll();
    });

    expect(result.current.state).toBe("saved");
    expect(result.current.dirty).toBe(false);
  });
});
