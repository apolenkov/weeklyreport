import { act, renderHook } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import {
  ACTIVITY_ID,
  PROJECT_ID,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import { buildRecordEditorHarness } from "./__tests__/overview-record-test-harness";
import type { useOverviewRecordEditor } from "./use-overview-record-editor";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

function enter(
  record: ReturnType<typeof useOverviewRecordEditor>,
  text: string,
) {
  const state = expectDefined(record.state);
  if (state.kind === "risk") record.changeRisk({ ...state.value, text });
  else record.changeDecision({ ...state.value, text });
}

describe.each(["risk", "decision"] as const)("contextual %s scope", (kind) => {
  it("keeps input and does not save after owned stages are removed", async () => {
    const harness = buildRecordEditorHarness();
    const { result, rerender } = renderHook(
      (serverSection: ReportSectionReadModel) =>
        harness.useEditor({ serverSection }),
      {
        initialProps: harness.server,
        wrapper: harness.wrapper,
      },
    );
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "product",
        unitId: PROJECT_ID,
      }),
    );
    act(() => {
      const state = expectDefined(result.current.record.state);
      const value = {
        ...state.value,
        text: "Keep this draft",
        stageNames: ["Development"],
      };
      if (state.kind === "risk")
        result.current.record.changeRisk({ ...state.value, ...value });
      else result.current.record.changeDecision({ ...state.value, ...value });
    });
    rerender({
      ...harness.server,
      version: harness.server.version + 1,
      projects: harness.server.projects.map((project) => ({
        ...project,
        ownedStages: [],
      })),
    });
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(harness.calls).toHaveLength(0);
    expect(result.current.record.state?.value.text).toBe("Keep this draft");
    expect(result.current.record.state?.value.stageNames).toEqual([
      "Development",
    ]);
    expect(result.current.record.state?.errors.stageNames).toMatch(/eligible/);
  });

  it("retains a dispatched input after edit permission is lost without confirming or compensating", async () => {
    const acknowledgement = Promise.withResolvers<ReportSectionReadModel>();
    const harness = buildRecordEditorHarness(() => acknowledgement.promise);
    const { result, rerender } = renderHook(
      (readOnly: boolean) => harness.useEditor({ readOnly }),
      { initialProps: false, wrapper: harness.wrapper },
    );
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    act(() => enter(result.current.record, "Retain after permission change"));
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    rerender(true);
    act(() => result.current.record.close());
    await act(async () => {
      acknowledgement.resolve(harness.reply(expectDefined(harness.calls[0])));
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.record.state?.value.text).toBe(
      "Retain after permission change",
    );
    expect(harness.calls).toHaveLength(1);
  });

  it("does not duplicate the create in StrictMode or when Save is pressed twice", async () => {
    const acknowledgement = Promise.withResolvers<ReportSectionReadModel>();
    const harness = buildRecordEditorHarness(() => acknowledgement.promise);
    function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <StrictMode>
          <harness.wrapper>{children}</harness.wrapper>
        </StrictMode>
      );
    }
    const { result } = renderHook(() => harness.useEditor(), {
      wrapper: Wrapper,
    });
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    act(() => enter(result.current.record, "One intended lineage"));
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    act(() => result.current.record.submit());
    expect(harness.calls).toHaveLength(1);
    await act(async () => {
      acknowledgement.resolve(harness.reply(expectDefined(harness.calls[0])));
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(harness.calls).toHaveLength(1);
    expect(result.current.record.state).toBeNull();
  });
});
