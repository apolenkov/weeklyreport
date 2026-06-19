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
import { createMockTRPC } from "../test-utils/mock-trpc";
import { useLeadFormAutosave } from "./use-lead-form-autosave";

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
        // enforce-item-decision-stage-schema: stageIds required on write.
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
    // eslint-disable-next-line @typescript-eslint/require-await -- default mock satisfies the async mutationFn contract (no awaitable work in the stub)
    (async () => {
      return { ok: true };
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
  captured["reports.saveDraft"].mutationFn.mockImplementation(
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

    expect(calls.length).toBeGreaterThanOrEqual(1);
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

  it('on mutation error transitions to state="error" and calls toast.error', async () => {
    const { wrapper } = buildHarness({
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async mutationFn contract; throws synchronously but must satisfy Promise<unknown> return type
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
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.state).toBe("error");
    expect(toast.error).toHaveBeenCalledWith("Network down");
  });

  it("after an error the form stays dirty and the next edit retries the save", async () => {
    // D7 (defer-versions-coming-soon): failure keeps dirty=true so the user's
    // work is not silently marked saved; the next edit fires saveDraft again.
    let failNext = true;
    const { wrapper, calls } = buildHarness({
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async mutationFn contract; throws synchronously but must satisfy Promise<unknown> return type
      mutationFn: async () => {
        if (failNext) throw new Error("Network down");
        return { ok: true };
      },
    });
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
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
    // D7 (defer-versions-coming-soon) / INT-07: unsaved edits must arm the
    // beforeunload guard; a successful save must disarm it.
    const { wrapper } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("guard-me"),
          enabled: true,
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
          debounceMs: 3000,
        }),
      { wrapper },
    );

    // Trigger via forceSave.
    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });

    // While mutation is pending, isInFlight should be true.
    expect(result.current.isInFlight).toBe(true);

    // Resolve the mutation.
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

  it("queued forceSave fires with the stashed payload (not a later payloadRef update)", async () => {
    // Arrange: first mutation is slow; subsequent ones resolve immediately.
    let resolveMutation!: () => void;
    let callCount = 0;
    const { wrapper, calls } = buildHarness({
      mutationFn: () => {
        callCount++;
        if (callCount === 1) {
          // First call: slow — held until we call resolveMutation().
          return new Promise<unknown>((resolve) => {
            resolveMutation = () => resolve({ ok: true });
          });
        }
        // Subsequent calls (queued save): resolve immediately.
        return Promise.resolve({ ok: true });
      },
    });

    const payloadP1 = makePayload("payload-p1");
    const payloadP2 = makePayload("payload-p2");

    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          debounceMs: 5000,
        }),
      { wrapper, initialProps: { payload: payloadP1 } },
    );

    // Trigger the first save (P1 in flight).
    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isInFlight).toBe(true);
    expect(calls).toHaveLength(1);

    // Payload changes to P2 while P1 is still in flight.
    rerender({ payload: payloadP2 });

    // Queue a second forceSave while in flight — should stash P2 key+payload.
    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });
    // Still in flight (mutation not resolved yet), no second mutation fired.
    expect(calls).toHaveLength(1);

    // Resolve P1 — the queued save (P2) should fire automatically and complete.
    await act(async () => {
      resolveMutation();
      await vi.runAllTimersAsync();
    });

    // Second mutation must have fired with the P2 payload.
    expect(calls).toHaveLength(2);
    // After both saves complete the hook should not be dirty.
    // (dirty = payloadKey !== lastSavedRef; lastSavedRef is set to P2's key)
    expect(result.current.dirty).toBe(false);
  });

  it("invalidates leadForm queries after successful save (cross-tab sync)", async () => {
    const { wrapper, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload: makePayload("cross-tab"),
          enabled: true,
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.state).toBe("saved");
    // JSON.stringify of the nested key [["leadForm","byPeriod"]] contains "leadForm"
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify(c[0]),
    );
    expect(invalidatedKeys.some((k) => k.includes("leadForm"))).toBe(true);
  });
});
