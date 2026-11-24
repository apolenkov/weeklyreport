import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import {
  ACTIVITY_ID,
  PROJECT_ID,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import { buildRecordEditorHarness } from "./__tests__/overview-record-test-harness";
import type { RetainedRecordCopy } from "./retained-record-copy";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});
const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));

function source(kind: "risk" | "decision"): RetainedRecordCopy {
  const common = { text: "Retained source text", impact: null, stageNames: [] };
  const sourceParent = { kind: "activity" as const, id: ACTIVITY_ID };
  return kind === "risk"
    ? {
        kind,
        sourceParent,
        input: {
          ...common,
          mitigation: "Existing mitigation",
          severity: "blocked",
        },
      }
    : { kind, sourceParent, input: { ...common, deadline: "2026-12-01" } };
}

describe.each(["risk", "decision"] as const)("%s recovery prefill", (kind) => {
  it("retains prefilled input without a write and retries one fresh identity verbatim", async () => {
    const copy = source(kind);
    const original = structuredClone(copy);
    const h = buildRecordEditorHarness((request) =>
      h.calls.length === 1
        ? Promise.reject(new Error("Response lost"))
        : Promise.resolve(h.reply(request)),
    );
    const { result } = renderHook(() => h.useEditor(), { wrapper: h.wrapper });
    act(() =>
      expect(
        result.current.record.openCopy(copy, {
          kind,
          unitKind: "activity",
          unitId: ACTIVITY_ID,
        }),
      ).toBe(true),
    );
    const opened = expectDefined(result.current.record.state);
    expect(opened.value).toEqual(copy.input);
    expect(opened.initial.text).toBe("");
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(h.calls).toHaveLength(0);
    act(() => result.current.record.submit());
    await settle();
    expect(result.current.draft.saveRecovery?.phase).toBe("ambiguous");
    act(() => result.current.record.submit());
    await settle();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]).toEqual(h.calls[0]);
    const request = expectDefined(h.calls[1]);
    const rows = kind === "risk" ? request.risks : request.decisions;
    expect(
      rows.filter((row) => row.stableId === opened.identity.stableId),
    ).toHaveLength(1);
    if (kind === "decision")
      expect(
        request.decisions.find(
          (row) => row.stableId === opened.identity.stableId,
        )?.owner,
      ).toBe(h.server.authorName);
    expect(result.current.record.state).toBeNull();
    expect(copy).toEqual(original);
    act(() => {
      result.current.record.openCopy(copy, {
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      });
    });
    expect(result.current.record.state?.identity.stableId).not.toBe(
      opened.identity.stableId,
    );
  });

  it("does not replace pending input or open a readonly or missing target", () => {
    const h = buildRecordEditorHarness();
    const { result, rerender } = renderHook(
      (readOnly: boolean) => h.useEditor({ readOnly }),
      { initialProps: true, wrapper: h.wrapper },
    );
    const copy = source(kind);
    const target = { kind, unitKind: "activity" as const, unitId: ACTIVITY_ID };
    act(() => expect(result.current.record.openCopy(copy, target)).toBe(false));
    rerender(false);
    act(() =>
      expect(
        result.current.record.openCopy(copy, {
          ...target,
          unitId: crypto.randomUUID(),
        }),
      ).toBe(false),
    );
    act(() => {
      result.current.record.openCopy(copy, target);
    });
    const retained = result.current.record.state;
    act(() => expect(result.current.record.openCopy(copy, target)).toBe(false));
    expect(result.current.record.state).toBe(retained);
    expect(h.calls).toHaveLength(0);
  });

  it("revalidates removed source stages before any write", async () => {
    const h = buildRecordEditorHarness();
    const { result } = renderHook(() => h.useEditor(), { wrapper: h.wrapper });
    const copy = source(kind);
    const reassigned = {
      ...copy,
      sourceParent: { kind: "product" as const, id: PROJECT_ID },
      input: { ...copy.input, stageNames: ["Removed source stage"] },
    } as RetainedRecordCopy;
    act(() => {
      result.current.record.openCopy(reassigned, {
        kind,
        unitKind: "product",
        unitId: PROJECT_ID,
      });
    });
    act(() => result.current.record.submit());
    await settle();
    expect(h.calls).toHaveLength(0);
    expect(result.current.record.state?.value.text).toBe(copy.input.text);
    expect(
      Object.keys(expectDefined(result.current.record.state).errors).length,
    ).toBeGreaterThan(0);
  });
});
