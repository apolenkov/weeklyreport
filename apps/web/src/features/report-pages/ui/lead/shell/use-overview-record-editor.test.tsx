import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import {
  ACTIVITY_ID,
  CURRENT_ITEM_ID,
  PROJECT_ID,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import { buildRecordEditorHarness } from "./__tests__/overview-record-test-harness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe.each(["risk", "decision"] as const)("contextual %s owner", (kind) => {
  it("retries an uncertain original verbatim while retaining later typing", async () => {
    let attempts = 0;
    const harness = buildRecordEditorHarness(
      (request): Promise<ReportSectionReadModel> => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("Response lost"));
        return Promise.resolve(harness.reply(request));
      },
    );
    const { result } = renderHook(() => harness.useEditor(), {
      wrapper: harness.wrapper,
    });
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    const typeText = (text: string) =>
      act(() => {
        const current = expectDefined(result.current.record.state);
        if (current.kind === "risk")
          result.current.record.changeRisk({ ...current.value, text });
        else result.current.record.changeDecision({ ...current.value, text });
      });
    typeText("Original request");
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.draft.saveRecovery?.phase).toBe("ambiguous");
    typeText("Later unsent input");
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]).toEqual(harness.calls[0]);
    expect(result.current.record.state?.value.text).toBe("Later unsent input");
    expect(result.current.record.state?.submission).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(harness.calls).toHaveLength(2);
  });

  it("settles an uncertain create with the original request before sending cancellation", async () => {
    let attempts = 0;
    const harness = buildRecordEditorHarness(
      (request): Promise<ReportSectionReadModel> => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("Response lost"));
        return Promise.resolve(harness.reply(request));
      },
    );
    const { result } = renderHook(() => harness.useEditor(), {
      wrapper: harness.wrapper,
    });
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    const opened = expectDefined(result.current.record.state);
    act(() => {
      if (opened.kind === "risk")
        result.current.record.changeRisk({
          ...opened.value,
          text: "Abandon this create",
        });
      else
        result.current.record.changeDecision({
          ...opened.value,
          text: "Abandon this create",
        });
    });
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.draft.saveRecovery?.phase).toBe("ambiguous");
    act(() => result.current.record.close());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(harness.calls).toHaveLength(3);
    expect(harness.calls[1]).toEqual(harness.calls[0]);
    const compensation = expectDefined(harness.calls[2]);
    expect(
      kind === "risk" ? compensation.risks : compensation.decisions,
    ).not.toContainEqual(
      expect.objectContaining({ stableId: opened.identity.stableId }),
    );
    expect(result.current.record.state).toBeNull();
  });

  it("waits for the original outcome before compensating cancellation and preserves later own edits", async () => {
    const acknowledgement = Promise.withResolvers<ReportSectionReadModel>();
    const harness = buildRecordEditorHarness((request) =>
      request.version === harness.server.version
        ? acknowledgement.promise
        : Promise.resolve(harness.reply(request)),
    );
    const { result } = renderHook(() => harness.useEditor(), {
      wrapper: harness.wrapper,
    });
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    const opened = expectDefined(result.current.record.state);
    act(() => {
      if (opened.kind === "risk")
        result.current.record.changeRisk({
          ...opened.value,
          text: "Cancel this create",
        });
      else
        result.current.record.changeDecision({
          ...opened.value,
          text: "Cancel this create",
        });
    });
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(harness.calls).toHaveLength(1);
    act(() => {
      result.current.draft.apply({
        kind: "item-patch",
        itemId: CURRENT_ITEM_ID,
        patch: { text: "Unrelated own edit" },
      });
      result.current.record.close();
    });
    expect(result.current.record.state).not.toBeNull();
    expect(harness.calls).toHaveLength(1);
    await act(async () => {
      acknowledgement.resolve(harness.reply(expectDefined(harness.calls[0])));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(harness.calls).toHaveLength(2);
    const compensation = expectDefined(harness.calls[1]);
    expect(compensation.version).toBe(harness.server.version + 1);
    expect(
      kind === "risk" ? compensation.risks : compensation.decisions,
    ).not.toContainEqual(
      expect.objectContaining({ stableId: opened.identity.stableId }),
    );
    expect(compensation.items).toContainEqual(
      expect.objectContaining({
        id: CURRENT_ITEM_ID,
        text: "Unrelated own edit",
      }),
    );
    expect(result.current.record.state).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(harness.calls).toHaveLength(2);
  });

  it("retains typing after dispatch for a separate save on the same lineage", async () => {
    const acknowledgement = Promise.withResolvers<ReportSectionReadModel>();
    const harness = buildRecordEditorHarness((request) =>
      request.version === harness.server.version
        ? acknowledgement.promise
        : Promise.resolve(harness.reply(request)),
    );
    const { result } = renderHook(() => harness.useEditor(), {
      wrapper: harness.wrapper,
    });
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    const opened = expectDefined(result.current.record.state);
    const typeText = (text: string) =>
      act(() => {
        const current = expectDefined(result.current.record.state);
        if (current.kind === "risk")
          result.current.record.changeRisk({ ...current.value, text });
        else result.current.record.changeDecision({ ...current.value, text });
      });
    typeText("First text");
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    typeText("Later text");
    await act(async () => {
      acknowledgement.resolve(harness.reply(expectDefined(harness.calls[0])));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.record.state?.value.text).toBe("Later text");
    expect(result.current.record.state?.submission).toBeNull();
    expect(harness.calls).toHaveLength(1);
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(harness.calls).toHaveLength(2);
    const second = expectDefined(harness.calls[1]);
    const rows = kind === "risk" ? second.risks : second.decisions;
    expect(
      rows.filter((row) => row.stableId === opened.identity.stableId),
    ).toHaveLength(1);
    expect(rows).toContainEqual(
      expect.objectContaining({
        stableId: opened.identity.stableId,
        [kind === "risk" ? "risk" : "text"]: "Later text",
      }),
    );
    expect(result.current.record.state).toBeNull();
  });

  it.each(["product", "activity"] as const)(
    "saves minimal %s input with its identity and closes only on the exact response",
    async (unitKind) => {
      const harness = buildRecordEditorHarness();
      const { result } = renderHook(() => harness.useEditor(), {
        wrapper: harness.wrapper,
      });
      act(() =>
        result.current.record.open({
          kind,
          unitKind,
          unitId: unitKind === "product" ? PROJECT_ID : ACTIVITY_ID,
        }),
      );
      const opened = expectDefined(result.current.record.state);
      expect(harness.calls).toHaveLength(0);
      act(() => {
        const fields = {
          text: "Named record",
          impact: null,
          stageNames: unitKind === "product" ? ["Development"] : [],
        };
        if (opened.kind === "risk")
          result.current.record.changeRisk({ ...opened.value, ...fields });
        else
          result.current.record.changeDecision({ ...opened.value, ...fields });
      });
      act(() => result.current.record.submit());
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(harness.calls).toHaveLength(1);
      const request = expectDefined(harness.calls[0]);
      const rows = kind === "risk" ? request.risks : request.decisions;
      expect(
        rows.filter((row) => row.stableId === opened.identity.stableId),
      ).toEqual([
        expect.objectContaining({
          ...opened.identity,
          impact: null,
          activityId: unitKind === "activity" ? ACTIVITY_ID : null,
        }),
      ]);
      expect(result.current.record.state).toBeNull();
      expect(result.current.draft.lastSaveReceipt?.attemptToken).toBeTruthy();
      expect(result.current.draft.lastSaveReceipt?.version).toBe(
        request.version + 1,
      );
    },
  );

  it("keeps input and blocks a save after the editor activation changes", async () => {
    const harness = buildRecordEditorHarness();
    const { result, rerender } = renderHook(
      (scopeChanged: boolean) => harness.useEditor({ scopeChanged }),
      { initialProps: false, wrapper: harness.wrapper },
    );
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    const opened = expectDefined(result.current.record.state);
    act(() => {
      if (opened.kind === "risk")
        result.current.record.changeRisk({
          ...opened.value,
          text: "Retain me",
        });
      else
        result.current.record.changeDecision({
          ...opened.value,
          text: "Retain me",
        });
    });
    rerender(true);
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(harness.calls).toHaveLength(0);
    expect(result.current.record.state?.value.text).toBe("Retain me");
  });
});
