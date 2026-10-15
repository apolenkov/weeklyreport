import { act, renderHook } from "@testing-library/react";
import {
  type DraftSavePayload,
  draftSaveSchema,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@weeklyreport/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import {
  CURRENT_ITEM_ID,
  makeDraftMergeSection,
  PROJECT_ID,
  RISK_ID,
} from "../lead-form/draft/lead-form-draft-merge-test-fixtures";
import { useLeadFormDraftCore } from "../lead-form/use-lead-form-draft-core";
import {
  countLocalOnlyRows,
  sectionToDraftPayload,
} from "../lead-section-draft-payload";
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { PersistedSaveResult } from "./autosave-types";
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
  it("saves a visible multilingual neighbour while retaining an invisible-only risk after ACK", async () => {
    const fixture = makeDraftMergeSection();
    const server = reportSectionReadModelSchema.parse({
      ...fixture,
      items: fixture.items.filter((item) => item.id === CURRENT_ITEM_ID),
      decisions: [],
    });
    const visibleText = "Отчёт 报告 👩‍💻 e\u0301";
    const acknowledgement = Promise.withResolvers<ReportSectionReadModel>();
    const { wrapper, calls, writePort } = buildHarness({
      mutationFn: (request) => {
        draftSaveSchema.parse(request);
        return acknowledgement.promise;
      },
    });
    const refetchSection = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useLeadFormDraftCore({
          writePort,
          generation: `${server.reportId}:${server.reportSectionId}`,
          serverSection: server,
          sectionIdForActions: server.reportSectionId,
          serverReadOnly: false,
          refetchSection,
        }),
      { wrapper },
    );

    act(() => {
      result.current.apply({
        kind: "item-patch",
        itemId: CURRENT_ITEM_ID,
        patch: { text: visibleText },
      });
      result.current.apply({
        kind: "risks",
        risks: [
          {
            id: RISK_ID,
            productId: PROJECT_ID,
            productName: "Test Product",
            stageNames: ["Development"],
            severity: "at-risk",
            text: "\u200B",
            impact: "Existing impact",
            mitigation: "Existing mitigation",
          },
        ],
      });
    });
    expect(result.current.autosave.state).toBe("pending");
    expect(result.current.draft?.risks[0]?.risk).toBe("\u200B");
    expect(calls).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(calls).toHaveLength(1);
    const request = calls[0];
    if (!request) throw new Error("Missing actual autosave request");
    expect(request.risks).toEqual([]);
    expect(
      request.items.find((item) => item.id === CURRENT_ITEM_ID)?.text,
    ).toBe(visibleText);
    expect(result.current.autosave.isInFlight).toBe(true);
    expect(result.current.lastSaveReceipt).toBeNull();

    // The transport fixture echoes only accepted rows, not the raw local risk.
    const saved = reportSectionReadModelSchema.parse({
      ...persistedReply(request, server),
      risks: [],
    });
    await act(async () => {
      acknowledgement.resolve(saved);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.autosave.state).toBe("saved");
    expect(result.current.autosave.isInFlight).toBe(false);
    expect(result.current.version).toBe(request.version + 1);
    expect(result.current.lastSaveReceipt).toMatchObject({
      reportSectionId: server.reportSectionId,
      version: saved.version,
    });
    expect(
      result.current.lastSaveReceipt?.persistedItems.find(
        (item) => item.id === CURRENT_ITEM_ID,
      )?.text,
    ).toBe(visibleText);
    const raw = result.current.draft;
    if (!raw) throw new Error("Missing raw correction draft after ACK");
    expect(raw.items.find((item) => item.id === CURRENT_ITEM_ID)?.text).toBe(
      visibleText,
    );
    expect(raw.risks).toMatchObject([
      {
        id: RISK_ID,
        risk: "\u200B",
        impact: "Existing impact",
        mitigation: "Existing mitigation",
      },
    ]);
    expect(countLocalOnlyRows(raw)).toBe(1);
    const leave = new Event("beforeunload", { cancelable: true });
    await act(() => window.dispatchEvent(leave));
    expect(leave.defaultPrevented).toBe(true);
    expect(calls).toHaveLength(1);
    expect(refetchSection).not.toHaveBeenCalled();
  });

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

  it("forceSave() does not invoke the mutation when the payload is absent", async () => {
    const { wrapper, calls, writePort } = buildHarness();
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
          reportSectionId: SECTION_ID,
          payload: null,
          enabled: true,
          version: 1,
          onVersionChange: vi.fn(),
          debounceMs: 3000,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.forceSave();
    });

    expect(calls).toHaveLength(0);
    expect(result.current.state).toBe("idle");
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

  it.each([
    {
      label: "ASCII keys",
      left: { beta: 2, alpha: 1 },
      right: { alpha: 1, beta: 2 },
      expected: '{"alpha":1,"beta":2}',
    },
    {
      label: "distinct keys tied by collation",
      left: { "\u00E9": 1, "e\u0301": 2 },
      right: { "e\u0301": 2, "\u00E9": 1 },
      expected: '{"e\u0301":2,"\u00E9":1}',
    },
    {
      label: "existing nonzero collation",
      left: { B: 2, a: 1 },
      right: { a: 1, B: 2 },
      expected: '{"a":1,"B":2}',
    },
  ])(
    "produces the same key regardless of object insertion order: $label",
    ({ left, right, expected }) => {
      expect(encodeAutosaveComparisonKey(left)).toBe(expected);
      expect(encodeAutosaveComparisonKey(right)).toBe(expected);
    },
  );

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

function persistedSection(text: string, sectionId = SECTION_ID) {
  return makeReportSectionFixture({
    reportSectionId: sectionId,
    projects: [
      {
        projectId: "22222222-2222-4222-8222-222222222222",
        projectName: "Product",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
      },
    ],
    items: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        stableId: "44444444-4444-4444-8444-444444444444",
        projectId: "22222222-2222-4222-8222-222222222222",
        activityId: null,
        type: "current",
        text,
        tag: "",
        nextStepText: null,
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [],
        priorityRank: null,
        pausedReason: null,
      },
    ],
  });
}

function persistedReply(
  request: DraftSavePayload,
  current: ReportSectionReadModel,
) {
  const item = current.items[0];
  if (!item) throw new Error("Missing persisted fixture item");
  return makeReportSectionFixture({
    ...current,
    version: request.version + 1,
    items: request.items.map((row) => ({
      ...item,
      ...row,
      stageNames: row.stageNames ?? item.stageNames,
      workflowStatus: row.workflowStatus,
      carriedOver: row.carriedOver ?? false,
    })),
  });
}

describe("persisted autosave intent", () => {
  it("writes an equal baseline at the current CAS version and accepts only its actual ACK", async () => {
    let server = persistedSection("baseline");
    const { wrapper, writePort, calls } = buildHarness({
      mutationFn: (request) => {
        expect(request.version).toBe(server.version);
        server = persistedReply(request, server);
        return Promise.resolve(server);
      },
    });
    const payload = sectionToDraftPayload(server);
    const { result } = renderHook(
      () =>
        useLeadFormAutosave({
          writePort,
          reportSectionId: SECTION_ID,
          payload,
          enabled: true,
          version: server.version,
          initialSavedKey: encodeDraftSaveComparisonKey(payload),
          onVersionChange: vi.fn(),
        }),
      { wrapper },
    );
    let receipt: PersistedSaveResult | undefined;
    await act(async () => {
      receipt = await result.current.savePersisted("restore");
    });
    expect(receipt).toMatchObject({
      status: "accepted",
      token: "restore",
      version: 2,
      payload,
    });
    expect(calls).toHaveLength(1);
    await act(async () => {
      await result.current.forceSave();
    });
    expect(calls).toHaveLength(1);
  });

  it.each([
    "overwrite",
    "suppression",
    "failure-cleanup",
    "rebase-null",
    "adopt",
    "activation",
    "dispose",
  ] as const)(
    "settles a queued persisted attempt exactly once on %s",
    async (drop) => {
      const server = persistedSection("baseline");
      const initial = sectionToDraftPayload(server);
      const edited = sectionToDraftPayload(persistedSection("in-flight edit"));
      const flight = Promise.withResolvers<ReportSectionReadModel>();
      const { wrapper, writePort, calls } = buildHarness({
        mutationFn: (request) =>
          calls.length === 1
            ? flight.promise
            : Promise.resolve(persistedReply(request, server)),
      });
      const { result, rerender, unmount } = renderHook(
        ({ payload, sectionId, enabled }) =>
          useLeadFormAutosave({
            writePort,
            reportSectionId: sectionId,
            payload,
            enabled,
            version: 1,
            initialSavedKey: encodeDraftSaveComparisonKey(initial),
            onVersionChange: vi.fn(),
            ...(drop === "rebase-null"
              ? {
                  onSaved: () => ({
                    savedKey: encodeDraftSaveComparisonKey(edited),
                    queuedPayload: null,
                  }),
                }
              : {}),
          }),
        {
          wrapper,
          initialProps: {
            payload: edited,
            sectionId: SECTION_ID,
            enabled: true,
          },
        },
      );
      let regular: Promise<void> | undefined;
      act(() => {
        regular = result.current.forceSave();
      });
      rerender({ payload: initial, sectionId: SECTION_ID, enabled: true });
      const settle = vi.fn();
      let pending: Promise<PersistedSaveResult> | undefined;
      act(() => {
        pending = result.current.savePersisted("queued").then((outcome) => {
          settle(outcome);
          return outcome;
        });
      });
      expect(settle).not.toHaveBeenCalled();
      if (drop === "overwrite")
        act(() => {
          void result.current.savePersisted("replacement");
        });
      if (drop === "adopt")
        act(() =>
          result.current.adoptBaseline(
            encodeDraftSaveComparisonKey(initial),
            "read",
          ),
        );
      if (drop === "activation")
        rerender({
          payload: {
            ...initial,
            reportSectionId: "99999999-9999-4999-8999-999999999999",
          },
          sectionId: "99999999-9999-4999-8999-999999999999",
          enabled: true,
        });
      if (drop === "dispose") unmount();
      if (drop === "suppression")
        rerender({ payload: initial, sectionId: SECTION_ID, enabled: false });
      await act(async () => {
        if (drop === "failure-cleanup")
          flight.reject(new Error("failed before commit"));
        else {
          const request = calls[0];
          if (!request) {
            throw new Error("No in-flight request");
          }
          flight.resolve(persistedReply(request, server));
        }
        await regular;
        await pending;
      });
      const status = ["suppression", "activation", "dispose"].includes(drop)
        ? "obsolete"
        : "superseded";
      expect(settle).toHaveBeenCalledExactlyOnceWith({
        status,
        token: "queued",
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(settle).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "rejection",
    "wrong-fields",
    "stale-version",
    "nonadvancing-version",
  ] as const)(
    "retains an unconfirmed %s and requires explicit retry",
    async (fault) => {
      let server = persistedSection("baseline");
      let attempts = 0;
      const payload = sectionToDraftPayload(persistedSection("intended"));
      const { wrapper, writePort, calls } = buildHarness({
        mutationFn: (request) => {
          attempts++;
          if (attempts === 1 && fault === "rejection")
            return Promise.reject(new Error("connection lost"));
          const response = persistedReply(request, server);
          if (attempts === 1 && fault === "wrong-fields")
            return Promise.resolve({ ...response, items: server.items });
          if (attempts === 1 && fault === "stale-version")
            return Promise.resolve({ ...response, version: 0 });
          if (attempts === 1 && fault === "nonadvancing-version")
            return Promise.resolve({ ...response, version: request.version });
          server = response;
          return Promise.resolve(server);
        },
      });
      const { result } = renderHook(
        () =>
          useLeadFormAutosave({
            writePort,
            payload,
            reportSectionId: SECTION_ID,
            enabled: true,
            version: 1,
            onVersionChange: vi.fn(),
          }),
        { wrapper },
      );
      let outcome: PersistedSaveResult | undefined;
      await act(async () => {
        outcome = await result.current.savePersisted("first");
      });
      expect(outcome?.status).toBe(
        fault === "stale-version" ? "obsolete" : "failed",
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(calls).toHaveLength(1);
      await act(async () => {
        outcome = await result.current.savePersisted("retry");
      });
      expect(outcome?.status).toBe("accepted");
      expect(calls).toHaveLength(2);
    },
  );
});

it.each(["adopt", "dispose", "A-B-A"] as const)(
  "invalidates an in-flight persisted intent exactly once on %s",
  async (transition) => {
    const first = persistedSection("captured A");
    const pendingResponse = Promise.withResolvers<ReportSectionReadModel>();
    const { wrapper, writePort, calls } = buildHarness({
      mutationFn: () => pendingResponse.promise,
    });
    const onVersionChange = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ payload, sectionId }) =>
        useLeadFormAutosave({
          writePort,
          payload,
          reportSectionId: sectionId,
          enabled: true,
          version: 1,
          onVersionChange,
          initialSavedKey: encodeDraftSaveComparisonKey(payload),
        }),
      {
        wrapper,
        initialProps: {
          payload: sectionToDraftPayload(first),
          sectionId: SECTION_ID,
        },
      },
    );
    const settled = vi.fn();
    let forced: Promise<unknown> | undefined;
    act(() => {
      forced = result.current.savePersisted("old-activation").then(settled);
    });
    if (transition === "dispose") unmount();
    if (transition === "adopt")
      act(() =>
        result.current.adoptBaseline(
          encodeDraftSaveComparisonKey(sectionToDraftPayload(first)),
          "read",
        ),
      );
    if (transition === "A-B-A") {
      const sectionB = "99999999-9999-4999-8999-999999999999";
      rerender({
        payload: sectionToDraftPayload(persistedSection("B", sectionB)),
        sectionId: sectionB,
      });
      rerender({
        payload: sectionToDraftPayload(persistedSection("new A")),
        sectionId: SECTION_ID,
      });
    }
    await act(async () => {
      await forced;
    });
    expect(settled).toHaveBeenCalledExactlyOnceWith({
      status: transition === "adopt" ? "superseded" : "obsolete",
      token: "old-activation",
    });
    const request = calls[0];
    if (!request) throw new Error("Missing captured request");
    await act(async () => {
      pendingResponse.resolve(persistedReply(request, first));
      await pendingResponse.promise;
    });
    expect(settled).toHaveBeenCalledTimes(1);
    expect(onVersionChange).not.toHaveBeenCalled();
    if (transition !== "dispose") {
      expect(result.current.lastSavedAt).toBeNull();
      expect(result.current.currentPayloadMatchesSavedBaseline).toBe(true);
    }
  },
);
