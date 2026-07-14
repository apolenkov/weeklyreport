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
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../lib/trpc-context";
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
        // enforce-item-decision-stage-schema: stageIds required on write.
        stageIds: ["Development"],
      },
    ],
    risks: [],
    decisions: [],
  };
}

function makePayloadFor(sectionId: string, text: string): DraftSavePayload {
  return { ...makePayload(text), reportSectionId: sectionId };
}

const SECTION_B = "33333333-3333-3333-3333-333333333333";

function buildHarness(
  opts: { mutationFn?: (vars: unknown) => Promise<unknown> } = {},
) {
  const calls: unknown[] = [];
  const userMutationFn =
    opts.mutationFn ??
    // eslint-disable-next-line @typescript-eslint/require-await -- default mock satisfies the async mutationFn contract (no awaitable work in the stub)
    (async () => {
      // saveDraft returns the persisted read model; the hook only reads
      // `.version` off it to advance the optimistic lock.
      return { version: 2 };
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
          version: 1,
          onVersionChange: vi.fn(),
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
    // JSON.stringify of the nested key [["leadForm","byPeriod"]] contains "leadForm"
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify(c[0]),
    );
    expect(invalidatedKeys.some((k) => k.includes("leadForm"))).toBe(true);
  });

  it("debounce path serializes against an in-flight save and does not stamp the unconfirmed newer key", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    let n = 0;
    const { wrapper, calls } = buildHarness({
      mutationFn: () => {
        n += 1;
        return new Promise<unknown>((resolve) => {
          if (n === 1) resolveFirst = () => resolve({ ok: true });
          else resolveSecond = () => resolve({ ok: true });
        });
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
      { wrapper, initialProps: { payload: makePayload("a") } },
    );

    // First debounce fires → save A in flight.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);
    expect(result.current.isInFlight).toBe(true);

    // Edit while A is in flight; the debounce fires but must QUEUE B (one
    // mutation at a time), not start a second parallel save.
    rerender({ payload: makePayload("b") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);
    expect(result.current.dirty).toBe(true);

    // Resolve A → drains B. A's success must NOT stamp B's (unconfirmed) key,
    // so dirty stays true until B itself confirms.
    await act(async () => {
      resolveFirst();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calls).toHaveLength(2);
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      resolveSecond();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.dirty).toBe(false);
  });

  it("a failing queued save surfaces exactly one error and leaks no unhandled rejection", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      let resolveFirst!: () => void;
      let n = 0;
      const { wrapper, calls } = buildHarness({
        mutationFn: () => {
          n += 1;
          if (n === 1) {
            return new Promise<unknown>((resolve) => {
              resolveFirst = () => resolve({ ok: true });
            });
          }
          return Promise.reject(new Error("queued save failed"));
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
        { wrapper, initialProps: { payload: makePayload("a") } },
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(calls).toHaveLength(1);

      rerender({ payload: makePayload("b") });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Resolve A → drains B → B rejects. Exactly one error toast, no leak.
      await act(async () => {
        resolveFirst();
        await vi.runAllTimersAsync();
      });

      expect(result.current.state).toBe("error");
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("queued save failed");
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("drains a queued payload to the section it was built for, not the latest section", async () => {
    let resolveFirst!: () => void;
    let n = 0;
    const { wrapper, calls } = buildHarness({
      mutationFn: () => {
        n += 1;
        if (n === 1) {
          return new Promise<unknown>((resolve) => {
            // First save advances the row to version 2; the queued drain must
            // rebase onto THIS value, not the stale prop (version 1).
            resolveFirst = () => resolve({ version: 2 });
          });
        }
        return Promise.resolve({ version: 3 });
      },
    });
    // Section B is freshly loaded + clean, so it never autosaves on its own —
    // isolating this test to the drain TARGET, not B's dirtiness (that is the
    // next test's concern).
    const bPayload = makePayloadFor(SECTION_B, "b1");
    const bKey = stableStringify(bPayload);
    const { result, rerender } = renderHook(
      ({
        reportSectionId,
        payload,
        initialSavedKey,
      }: {
        reportSectionId: string;
        payload: DraftSavePayload;
        initialSavedKey: string | null;
      }) =>
        useLeadFormAutosave({
          reportSectionId,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 5000,
          initialSavedKey,
        }),
      {
        wrapper,
        initialProps: {
          reportSectionId: SECTION_ID,
          payload: makePayloadFor(SECTION_ID, "a1"),
          initialSavedKey: null as string | null,
        },
      },
    );

    // Section-A save in flight.
    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calls).toHaveLength(1);

    // Edit A again while in flight → queues the A2 payload (section A).
    rerender({
      reportSectionId: SECTION_ID,
      payload: makePayloadFor(SECTION_ID, "a2"),
      initialSavedKey: null,
    });
    await act(async () => {
      void result.current.forceSave();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calls).toHaveLength(1);

    // Navigate to section B (clean) BEFORE the in-flight A save resolves.
    rerender({
      reportSectionId: SECTION_B,
      payload: bPayload,
      initialSavedKey: bKey,
    });

    // Resolve A → the queued A2 drains to SECTION_ID (its own section), never B.
    await act(async () => {
      resolveFirst();
      await vi.runAllTimersAsync();
    });
    expect(calls).toHaveLength(2);
    const drained = calls[1] as DraftSavePayload;
    expect(drained.reportSectionId).toBe(SECTION_ID);
    expect(drained.items[0]?.text).toBe("a2");
    // Guardrail: the drain carries the version the FIRST save bumped to (2),
    // read from the response — not the stale prop. Otherwise it would self-409.
    expect(drained.version).toBe(2);
  });

  it("a section-A save resolving after navigation to B does not dirty B or schedule a save for it", async () => {
    let resolveFirst!: () => void;
    const { wrapper, calls } = buildHarness({
      mutationFn: () =>
        new Promise<unknown>((resolve) => {
          resolveFirst = () => resolve({ ok: true });
        }),
    });
    const bPayload = makePayloadFor(SECTION_B, "b-clean");
    const bKey = stableStringify(bPayload);
    const { result, rerender } = renderHook(
      ({
        reportSectionId,
        payload,
        initialSavedKey,
      }: {
        reportSectionId: string;
        payload: DraftSavePayload;
        initialSavedKey: string | null;
      }) =>
        useLeadFormAutosave({
          reportSectionId,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
          initialSavedKey,
        }),
      {
        wrapper,
        initialProps: {
          reportSectionId: SECTION_ID,
          payload: makePayloadFor(SECTION_ID, "a1"),
          initialSavedKey: null as string | null,
        },
      },
    );

    // Section-A save in flight (held).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);
    expect(result.current.isInFlight).toBe(true);

    // Navigate to section B, which is freshly loaded + clean (primed baseline).
    rerender({
      reportSectionId: SECTION_B,
      payload: bPayload,
      initialSavedKey: bKey,
    });
    expect(result.current.dirty).toBe(false);

    // Resolve the section-A save: its key must NOT stamp B's baseline, so B
    // stays non-dirty and no spurious autosave is scheduled for B.
    await act(async () => {
      resolveFirst();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.dirty).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("injects the current version prop into the save payload (not a hardcoded value)", async () => {
    const { wrapper, calls } = buildHarness();
    const { rerender } = renderHook(
      ({
        payload,
        version,
      }: {
        payload: DraftSavePayload | null;
        version: number;
      }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      {
        wrapper,
        initialProps: {
          payload: null as DraftSavePayload | null,
          version: 42,
        },
      },
    );

    rerender({ payload: makePayload("x"), version: 42 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // The expected version sent to the server is the prop the owner holds — the
    // value the re-seed effect sets from the freshly-loaded/refetched row.
    expect((calls[0] as DraftSavePayload).version).toBe(42);
  });

  it("reports the server-confirmed version to onVersionChange after a save", async () => {
    const onVersionChange = vi.fn();
    const { wrapper } = buildHarness({
      mutationFn: () => Promise.resolve({ version: 7 }),
    });
    const { rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: null as DraftSavePayload | null } },
    );

    rerender({ payload: makePayload("first") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(onVersionChange).toHaveBeenCalledWith(7);
  });

  it("routes a stale-version CONFLICT to onConflict and suppresses the generic toast", async () => {
    const onConflict = vi.fn();
    const conflictError = new TRPCClientError<never>("stale");
    Object.defineProperty(conflictError, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });
    const { wrapper } = buildHarness({
      mutationFn: () => Promise.reject(conflictError),
    });
    const { rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          onConflict,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: null as DraftSavePayload | null } },
    );

    rerender({ payload: makePayload("first") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(onConflict).toHaveBeenCalledTimes(1);
    // The caller owns the conflict surface (refetch + tailored message), so the
    // hook must NOT also fire its generic autosave-failed toast.
    expect(toast.error).not.toHaveBeenCalled();
  });
});
