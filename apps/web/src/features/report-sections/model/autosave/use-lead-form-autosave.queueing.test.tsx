import type { DraftSavePayload } from "@customreport/shared";
import { act, renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  encodeAutosaveComparisonKey,
  useLeadFormAutosave,
} from "./use-lead-form-autosave";
import {
  AUTOSAVE_SECTION_ID as SECTION_ID,
  buildAutosaveHarness as buildHarness,
  makeAutosavePayload as makePayload,
  makeAutosavePayloadFor as makePayloadFor,
} from "./use-lead-form-autosave-harness";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const SECTION_B = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useLeadFormAutosave — queueing, versioning & conflicts", () => {
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

  it("retries a queued edit after the in-flight save fails", async () => {
    let rejectFirst!: () => void;
    let callCount = 0;
    const { wrapper, calls } = buildHarness({
      mutationFn: () => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise<unknown>((_resolve, reject) => {
            rejectFirst = () => reject(new Error("save A failed"));
          });
        }
        return Promise.resolve({ version: 2 });
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
      { wrapper, initialProps: { payload: makePayload("edit A") } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);

    rerender({ payload: makePayload("edit B") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);

    await act(async () => {
      rejectFirst();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(calls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(calls).toHaveLength(2);
    expect((calls[1] as DraftSavePayload).items[0]?.text).toBe("edit B");
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
    const bKey = encodeAutosaveComparisonKey(bPayload);
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
    const bKey = encodeAutosaveComparisonKey(bPayload);
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

  it("a CONFLICT with a queued edit hands off to onConflict without re-arming a retry", async () => {
    const onConflict = vi.fn();
    let rejectFirst!: () => void;
    const conflictError = new TRPCClientError<never>("stale");
    Object.defineProperty(conflictError, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });
    const { calls, wrapper } = buildHarness({
      mutationFn: () =>
        new Promise<unknown>((_resolve, reject) => {
          rejectFirst = () => reject(conflictError);
        }),
    });
    const { rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload }) =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          onConflict,
          debounceMs: 3000,
        }),
      { wrapper, initialProps: { payload: makePayload("edit A") } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);

    // Queue edit B behind the in-flight save, then fail the save with a 409.
    rerender({ payload: makePayload("edit B") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(calls).toHaveLength(1);

    await act(async () => {
      rejectFirst();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();

    // The conflict flow owns recovery (refetch + rebuild): replaying the
    // queued edit against the stale version would just 409 again, so no
    // retry save may fire on its own.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(calls).toHaveLength(1);
  });

  it("renders idle and clean when initialSavedKey already matches the first payload key", () => {
    const { wrapper } = buildHarness();
    const payload = makePayload("already-saved");
    const initialSavedKey = encodeAutosaveComparisonKey(payload);

    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
          initialSavedKey,
        }),
      { wrapper },
    );

    // Primed clean from the first render — no edit, so never pending.
    expect(result.current.dirty).toBe(false);
    expect(result.current.state).toBe("idle");
  });
});
