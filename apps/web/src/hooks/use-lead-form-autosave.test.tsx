// Timer recipe for this file:
//   - vi.useFakeTimers() is active for all tests (see beforeEach).
//   - Use vi.advanceTimersByTimeAsync(n) inside act() to advance the debounce
//     clock — this drains microtasks AND TanStack Query's setTimeout(0) notifier.
//   - vi.runAllTimersAsync() is allowed only as a terminal drain when no later
//     assertion depends on un-elapsed time.
//   - NEVER use Testing Library waitFor / findBy* here: globals:false in
//     vitest.config.ts and no jest shim in vitest.setup.ts means TL's polling
//     timer is itself faked and the call deadlocks until test timeout.

import type { DraftSavePayload } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../lib/trpc-context";
import { expectDefined } from "../test-utils/expect-defined.js";
import { createMockTRPC } from "../test-utils/mock-trpc";
import { stableStringify, useLeadFormAutosave } from "./use-lead-form-autosave";

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
    // The hook ignores this and injects its live version at mutate time; kept
    // only so the literal satisfies DraftSavePayload.
    version: 1,
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
        // stageIds required on write.
        stageIds: ["Development"],
      },
    ],
    risks: [],
    decisions: [],
  };
}

function buildHarness(
  opts: { mutationFn?: (vars: unknown) => Promise<unknown> } = {},
) {
  const calls: unknown[] = [];
  const userMutationFn =
    opts.mutationFn ??
    (() => {
      // saveDraft returns the persisted read model; the hook only reads
      // `.version` off it to advance the optimistic lock.
      return Promise.resolve({ version: 2 });
    });

  const { proxy, captured } = createMockTRPC([
    {
      path: ["reports", "saveDraft"],
      mutation: true,
    },
    { path: ["reports", "getActive"] },
    { path: ["reports", "myHistory"] },
    { path: ["leadForm", "byPeriod"] },
  ]);

  // Wire the captured saveDraft mutationFn to delegate to the harness's
  // own calls array and user-supplied mutationFn — same contract as before.
  expectDefined(captured["reports.saveDraft"]).mutationFn.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async mock implementation; Promise is consumed by React Query, not discarded
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
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
          version: 1,
          onVersionChange: vi.fn(),
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
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(calls).toHaveLength(1);
    expect(result.current.state).toBe("saved");
  });

  it("coalesces two rapid changes within the debounce window into a single mutation call", async () => {
    const { wrapper, calls } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: makePayload("a") } },
    );

    expect(result.current.state).toBe("pending");

    // 1000ms in, change again -> debounce restarts.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    rerender({ payload: makePayload("b") });

    // 1000ms more (2s total since first change, 1s since second).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(calls).toHaveLength(0);

    // 2000ms more — second debounce expires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(calls).toHaveLength(1);
  });

  it("does not restart the debounce window on a re-render that leaves the payload unchanged", async () => {
    const { wrapper, calls } = buildHarness();
    const { rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          // A fresh callback identity every render, like a real caller.
          onVersionChange: () => undefined,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: makePayload("a") } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    // New object, deep-equal content: the debounce must keep counting from the
    // original edit rather than resetting.
    rerender({ payload: makePayload("a") });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(calls).toHaveLength(1);
  });

  it('sets state="saved" and lastSavedAt to a Date after success', async () => {
    const { wrapper } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("hello"),
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
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
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: initial } },
    );

    // First save completes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.state).toBe("saved");
    expect(calls).toHaveLength(1);

    // Pass an equivalent (new reference, identical content) payload.
    rerender({ payload: makePayload("same") });

    // dirty must be false; no new pending transition.
    expect(result.current.dirty).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(calls).toHaveLength(1);
  });

  it("does not autosave when enabled=false (e.g. read-only or submitted)", async () => {
    const { wrapper, calls } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("locked"),
          enabled: false,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    expect(result.current.dirty).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(calls).toHaveLength(0);
    expect(result.current.state).toBe("idle");
  });

  it("keeps a rejected save dirty and surfaces the server error", async () => {
    const { wrapper } = buildHarness({
      mutationFn: () => {
        return Promise.reject(new Error("Network down"));
      },
    });
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("boom"),
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.state).toBe("error");
    expect(toast.error).toHaveBeenCalledWith("Network down");
    expect(result.current.dirty).toBe(true);
  });

  it("after an error the form stays dirty and the next edit retries the save", async () => {
    // Failure keeps dirty=true so the user's work is not silently marked
    // saved; the next edit fires saveDraft again.
    let failNext = true;
    const { wrapper, calls } = buildHarness({
      mutationFn: () => {
        if (failNext) return Promise.reject(new Error("Network down"));
        return Promise.resolve({ ok: true });
      },
    });
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: makePayload("first-try") } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.state).toBe("error");
    expect(result.current.dirty).toBe(true);
    expect(calls).toHaveLength(1);

    // Next edit retries: a new payload restarts the debounce and saves.
    failNext = false;
    rerender({ payload: makePayload("second-try") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(calls).toHaveLength(2);
    expect(result.current.state).toBe("saved");
    expect(result.current.dirty).toBe(false);
  });

  it("blocks beforeunload while dirty and releases the guard after save", async () => {
    // Unsaved edits must arm the beforeunload guard; a successful save
    // must disarm it.
    const { wrapper } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("guard-me"),
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    expect(result.current.dirty).toBe(true);
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(dirtyEvent);
    });
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.dirty).toBe(false);

    const cleanEvent = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(cleanEvent);
    });
    expect(cleanEvent.defaultPrevented).toBe(false);
  });

  it("exposes dirty=true while a change is pending and dirty=false after success", async () => {
    const { wrapper } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: null as DraftSavePayload | null } },
    );

    expect(result.current.dirty).toBe(false);

    rerender({ payload: makePayload("dirty") });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.state).toBe("saved");
    expect(result.current.dirty).toBe(false);
  });

  it("forceSave() bypasses debounce and triggers immediate save", async () => {
    const { wrapper, calls } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("force-me"),
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 5000,
        }),
      { wrapper },
    );

    // Hook starts pending (debounce in flight), no mutation yet.
    expect(result.current.state).toBe("pending");
    expect(calls).toHaveLength(0);

    // Call forceSave — should bypass the 5s debounce immediately.
    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });

    // Mutation must have fired without advancing timers by 5000ms.
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(result.current.state).toBe("saved");
  });

  it("Save button isInFlight becomes true while save is in flight", async () => {
    // Use a slow mutation to hold isPending=true for inspection.
    let resolveMutation!: () => void;
    const { wrapper } = buildHarness({
      mutationFn: () =>
        new Promise<unknown>((resolve) => {
          resolveMutation = () => resolve({ ok: true });
        }),
    });

    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("in-flight"),
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });

    // While mutation is pending, isInFlight should be true.
    expect(result.current.isInFlight).toBe(true);

    await act(async () => {
      resolveMutation();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isInFlight).toBe(false);
    expect(result.current.state).toBe("saved");
  });

  it("Save button shows ✓ Saved after success (state=saved transitions)", async () => {
    const { wrapper } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("check-saved"),
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.state).toBe("saved");
    expect(result.current.isInFlight).toBe(false);
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });
});

describe("stableStringify", () => {
  it("produces different keys for payloads that differ only by a Date-typed field", () => {
    const decision = {
      text: "Ship v2",
      owner: "Alice",
      impact: "impact",
      deadline: new Date("2026-01-01T00:00:00.000Z"),
      stageIds: ["Development"],
    };
    const early = { ...makePayload(), decisions: [decision] };
    const late = {
      ...makePayload(),
      decisions: [
        { ...decision, deadline: new Date("2026-02-01T00:00:00.000Z") },
      ],
    };

    expect(stableStringify(early)).not.toBe(stableStringify(late));
  });

  it("serializes a Date as its ISO string rather than collapsing it to {}", () => {
    const deadline = new Date("2026-01-01T00:00:00.000Z");
    expect(stableStringify({ deadline })).toBe(
      `{"deadline":${JSON.stringify(deadline.toISOString())}}`,
    );
  });
});
