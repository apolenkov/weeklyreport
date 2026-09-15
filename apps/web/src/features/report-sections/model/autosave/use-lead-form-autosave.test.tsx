import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import { useLeadFormAutosave } from "./use-lead-form-autosave";
import {
  AUTOSAVE_SECTION_ID as SECTION_ID,
  buildAutosaveHarness as buildHarness,
  makeAutosavePayload as makePayload,
  makeAutosaveResponse as makeResponse,
} from "./use-lead-form-autosave-harness";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useLeadFormAutosave", () => {
  it("compares the saved baseline even when a failed draft becomes read-only", async () => {
    const { wrapper, calls, writePort } = buildHarness({
      mutationFn: () => Promise.reject(new Error("Network down")),
    });
    const baseline = makePayload("server");
    const edited = makePayload("unsaved N");
    const { result, rerender } = renderHook<
      ReturnType<typeof useLeadFormAutosave>,
      { payload: DraftSavePayload | null; enabled: boolean }
    >(
      ({ payload, enabled }) =>
        useLeadFormAutosave({
          writePort,
          reportSectionId: SECTION_ID,
          payload,
          enabled,
          version: 1,
          onVersionChange: vi.fn(),
          initialSavedKey: encodeDraftSaveComparisonKey(baseline),
        }),
      {
        wrapper,
        initialProps: {
          payload: baseline,
          enabled: true,
        },
      },
    );
    expect(result.current.currentPayloadMatchesSavedBaseline).toBe(true);
    rerender({ payload: edited, enabled: true });
    await act(async () => {
      await result.current.forceSave();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.dirty).toBe(true);
    expect(result.current.currentPayloadMatchesSavedBaseline).toBe(false);

    rerender({ payload: edited, enabled: false });
    expect(result.current.dirty).toBe(false);
    expect(result.current.currentPayloadMatchesSavedBaseline).toBe(false);

    // A refetch adopting N, unlike disabling writes, proves it is saved.
    act(() =>
      result.current.adoptBaseline(
        encodeDraftSaveComparisonKey(edited),
        "read",
      ),
    );
    expect(result.current.currentPayloadMatchesSavedBaseline).toBe(true);
    expect(calls).toHaveLength(1);
    rerender({ payload: null, enabled: false });
    act(() => result.current.primeBaseline(""));
    expect(result.current.currentPayloadMatchesSavedBaseline).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("starts idle with no payload, transitions to pending then saving", async () => {
    const { wrapper, calls, writePort } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, calls, writePort } = buildHarness();
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, calls, writePort } = buildHarness();
    const { rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, writePort } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, calls, writePort } = buildHarness();
    const initial = makePayload("same");
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload | null }) =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, calls, writePort } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, writePort } = buildHarness({
      mutationFn: () => {
        return Promise.reject(new Error("Network down"));
      },
    });
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, calls, writePort } = buildHarness({
      mutationFn: (request) => {
        if (failNext) return Promise.reject(new Error("Network down"));
        return Promise.resolve(makeResponse(request));
      },
    });
    const { result, rerender } = renderHook(
      ({ payload }: { payload: DraftSavePayload }) =>
        useLeadFormAutosave({
          writePort,
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
    const { wrapper, writePort } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
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

  it("forceSave() bypasses debounce and triggers immediate save", async () => {
    const { wrapper, calls, writePort } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
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
    expect(calls).toHaveLength(1);
    expect(result.current.state).toBe("saved");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(calls).toHaveLength(1);
  });

  it("exposes isInFlight while a save is pending", async () => {
    // Use a slow mutation to hold isPending=true for inspection.
    let resolveMutation!: () => void;
    const { wrapper, writePort } = buildHarness({
      mutationFn: (request) =>
        new Promise<ReportSectionReadModel>((resolve) => {
          resolveMutation = () => resolve(makeResponse(request));
        }),
    });

    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
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
});

describe("encodeAutosaveComparisonKey", () => {
  it("assigns explicit comparison keys to top-level and nested undefined", () => {
    expect(encodeAutosaveComparisonKey(undefined)).toBe("undefined");
    expect(encodeAutosaveComparisonKey({ value: undefined })).toBe(
      '{"value":undefined}',
    );
  });

  it("distinguishes sparse array holes from explicit undefined entries", () => {
    const sparse = [undefined, "value"];
    expect(Reflect.deleteProperty(sparse, "0")).toBe(true);

    expect(encodeAutosaveComparisonKey(sparse)).toBe('[<hole>,"value"]');
    expect(encodeAutosaveComparisonKey(sparse)).not.toBe(
      encodeAutosaveComparisonKey([undefined, "value"]),
    );
  });

  it("produces the same key regardless of object insertion order", () => {
    expect(encodeAutosaveComparisonKey({ beta: 2, alpha: 1 })).toBe(
      encodeAutosaveComparisonKey({ alpha: 1, beta: 2 }),
    );
  });

  it("produces different keys for payloads that differ only by a Date-typed field", () => {
    const decision = {
      text: "Ship v2",
      owner: "Alice",
      impact: "impact",
      deadline: new Date("2026-01-01T00:00:00.000Z"),
      stageNames: ["Development"],
    };
    const early = { ...makePayload(), decisions: [decision] };
    const late = {
      ...makePayload(),
      decisions: [
        { ...decision, deadline: new Date("2026-02-01T00:00:00.000Z") },
      ],
    };

    expect(encodeAutosaveComparisonKey(early)).not.toBe(
      encodeAutosaveComparisonKey(late),
    );
  });

  it("serializes a Date as its ISO string rather than collapsing it to {}", () => {
    const deadline = new Date("2026-01-01T00:00:00.000Z");
    expect(encodeAutosaveComparisonKey({ deadline })).toBe(
      `{"deadline":${JSON.stringify(deadline.toISOString())}}`,
    );
  });
});
