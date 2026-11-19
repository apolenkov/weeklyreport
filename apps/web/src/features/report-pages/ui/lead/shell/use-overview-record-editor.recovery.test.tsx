import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined";
import {
  ACTIVITY_ID,
  CURRENT_ITEM_ID,
  PROJECT_ID,
} from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import { LeadFormWriteError } from "../../../../report-sections/model/lead-form/lead-form-write-port";
import { buildRecordEditorHarness } from "./__tests__/overview-record-test-harness";
import {
  OverviewInputProvider,
  useRetainedOverviewState,
} from "./overview-input-provider";
import { prepareOverviewRecord } from "./overview-record-context";
import { overviewRecordPresentation } from "./overview-record-presentation";

type Harness = ReturnType<typeof buildRecordEditorHarness>;
type Editor = ReturnType<Harness["useEditor"]>;

vi.mock(
  "../../../../../shared/lib/auth/session-provider",
  async (original) => ({
    ...(await original<
      typeof import("../../../../../shared/lib/auth/session-provider")
    >()),
    useSession: () => ({
      user: { id: "10000000-0000-4000-8000-000000000001" },
    }),
  }),
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

function enter(editor: Editor, text: string, stageNames: string[] = []) {
  const state = expectDefined(editor.record.state);
  if (state.kind === "risk")
    editor.record.changeRisk({ ...state.value, text, stageNames });
  else editor.record.changeDecision({ ...state.value, text, stageNames });
}

const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));

describe.each(["risk", "decision"] as const)("%s recovery exits", (kind) => {
  it("retries a dropped cancellation once and waits for its exact receipt", async () => {
    const ordinary = Promise.withResolvers<ReportSectionReadModel>();
    const cancellation = Promise.withResolvers<ReportSectionReadModel>();
    const h = buildRecordEditorHarness(() =>
      h.calls.length === 1 ? ordinary.promise : cancellation.promise,
    );
    const { result } = renderHook(
      () => ({
        ...h.useEditor(),
        setRecord: useRetainedOverviewState("record", h.server.reportId)[1],
      }),
      {
        wrapper: ({ children }) => (
          <h.wrapper>
            <OverviewInputProvider>{children}</OverviewInputProvider>
          </h.wrapper>
        ),
      },
    );
    act(() =>
      result.current.draft.apply({
        kind: "item-patch",
        itemId: CURRENT_ITEM_ID,
        patch: { text: "Unrelated edit to retain" },
      }),
    );
    act(() => {
      void result.current.draft.save();
      result.current.record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      });
    });
    await settle();
    act(() => enter(result.current, "Cancel this record"));
    const opened = expectDefined(result.current.record.state);
    const prepared = prepareOverviewRecord(result.current.editor, opened);
    if (!prepared.ok) throw new Error("Expected valid record fixture");
    // Resume after the acknowledged create was locally removed, while an
    // ordinary save occupies the engine. Only the pending compensation is seeded.
    const token = crypto.randomUUID();
    act(() =>
      result.current.setRecord({
        ...opened,
        submission: {
          token: crypto.randomUUID(),
          record: prepared.record,
          before: null,
          input: opened.value,
          phase: "saving",
          cancelRequested: true,
          cancelRetried: false,
          discard: { token, armed: false },
        },
      }),
    );
    await settle();
    expect(h.calls).toHaveLength(1);
    await act(async () => {
      ordinary.reject(
        new LeadFormWriteError("restriction", "Earlier save rejected"),
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.record.state?.submission?.discard?.notSent).toBe(
      true,
    );
    act(() => result.current.record.submit());
    await settle();
    expect(h.calls).toHaveLength(2);
    expect(result.current.draft.saveRecovery?.token).toBe(token);
    expect(result.current.record.state).not.toBeNull();
    act(() => result.current.record.submit());
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(h.calls).toHaveLength(2);
    const request = expectDefined(h.calls[1]);
    expect([...request.risks, ...request.decisions]).not.toContainEqual(
      expect.objectContaining({ stableId: opened.identity.stableId }),
    );
    expect(request.items).toContainEqual(
      expect.objectContaining({
        id: CURRENT_ITEM_ID,
        text: "Unrelated edit to retain",
      }),
    );
    await act(async () => {
      cancellation.resolve(h.reply(request));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.record.state).toBeNull();
    expect(result.current.draft.lastSaveReceipt?.attemptToken).toBe(token);
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(h.calls).toHaveLength(2);
  });

  it.each(["retry", "cancel"])(
    "allows %s after an ordinary save failure drops the queued create",
    async (action) => {
      const first = Promise.withResolvers<ReportSectionReadModel>();
      const h = buildRecordEditorHarness((request) =>
        h.calls.length === 1
          ? first.promise
          : Promise.resolve(h.reply(request)),
      );
      const { result } = renderHook(() => h.useEditor(), {
        wrapper: h.wrapper,
      });
      act(() =>
        result.current.draft.apply({
          kind: "item-patch",
          itemId: CURRENT_ITEM_ID,
          patch: { text: "Other edit" },
        }),
      );
      act(() => {
        void result.current.draft.save();
      });
      await settle();
      act(() =>
        result.current.record.open({
          kind,
          unitKind: "activity",
          unitId: ACTIVITY_ID,
        }),
      );
      act(() => enter(result.current, "Keep my record"));
      const stableId = result.current.record.state?.identity.stableId;
      act(() => result.current.record.submit());
      await settle();
      await act(async () => {
        first.reject(new LeadFormWriteError("conflict", "Earlier save failed"));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(h.calls).toHaveLength(1);
      expect(result.current.record.state?.value.text).toBe("Keep my record");
      if (action === "retry")
        act(() => enter(result.current, "Revised before retry"));
      act(() =>
        action === "retry"
          ? result.current.record.submit()
          : result.current.record.close(),
      );
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      expect(result.current.record.state).toBeNull();
      const rows =
        kind === "risk"
          ? result.current.draft.draft?.risks
          : result.current.draft.draft?.decisions;
      expect(rows?.some((row) => row.stableId === stableId)).toBe(
        action === "retry",
      );
      if (action === "retry") {
        const request = expectDefined(h.calls.at(-1));
        expect(
          kind === "risk"
            ? request.risks.find((row) => row.stableId === stableId)?.risk
            : request.decisions.find((row) => row.stableId === stableId)?.text,
        ).toBe("Revised before retry");
      }
      if (action === "cancel")
        expect(
          h.calls
            .slice(1)
            .every((request) =>
              [...request.risks, ...request.decisions].every(
                (row) => row.stableId !== stableId,
              ),
            ),
        ).toBe(true);
    },
  );

  it.each(["retry", "cancel"])(
    "allows %s after a pending plan command refuses the local patch",
    async (action) => {
      const h = buildRecordEditorHarness();
      Object.assign(h.writePort.pending, { resolvePlan: true });
      const { result, rerender } = renderHook(() => h.useEditor(), {
        wrapper: h.wrapper,
      });
      act(() =>
        result.current.record.open({
          kind,
          unitKind: "activity",
          unitId: ACTIVITY_ID,
        }),
      );
      act(() => enter(result.current, "Keep refused input"));
      act(() => result.current.record.submit());
      await settle();
      expect(h.calls).toHaveLength(0);
      expect(result.current.record.state?.submission).toBeNull();
      Object.assign(h.writePort.pending, { resolvePlan: false });
      rerender();
      act(() =>
        action === "retry"
          ? result.current.record.submit()
          : result.current.record.close(),
      );
      await settle();
      expect(result.current.record.state).toBeNull();
      expect(h.calls).toHaveLength(action === "retry" ? 1 : 0);
    },
  );

  it("closes detached retained input without undoing or replaying a save from the previous activation", async () => {
    const pending = Promise.withResolvers<ReportSectionReadModel>();
    const h = buildRecordEditorHarness(() => pending.promise);
    let server = h.server;
    let current: Editor | undefined;
    function Child() {
      current = h.useEditor({ serverSection: server });
      const view = overviewRecordPresentation(
        current.editor,
        current.model,
        current.record,
      );
      return view.recovery ?? view.slot?.content;
    }
    function Parent({ show }: { show: boolean }) {
      return <OverviewInputProvider>{show && <Child />}</OverviewInputProvider>;
    }
    const view = render(<Parent show />, { wrapper: h.wrapper });
    act(() =>
      expectDefined(current).record.open({
        kind,
        unitKind: "activity",
        unitId: ACTIVITY_ID,
      }),
    );
    act(() => enter(expectDefined(current), "Retained across navigation"));
    act(() => expectDefined(current).record.submit());
    await settle();
    view.rerender(<Parent show={false} />);
    await act(async () => {
      server = h.reply(expectDefined(h.calls[0]));
      pending.resolve(server);
      await vi.advanceTimersByTimeAsync(0);
    });
    view.rerender(<Parent show />);
    expect(screen.getByRole("button", { name: "Close editor" })).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/does not undo/);
    act(() => screen.getByRole("button", { name: "Close editor" }).click());
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(expectDefined(current).record.state).toBeNull();
    expect(h.calls).toHaveLength(1);
    const rows =
      kind === "risk"
        ? expectDefined(current).draft.draft?.risks
        : expectDefined(current).draft.draft?.decisions;
    expect(rows).toEqual(kind === "risk" ? server.risks : server.decisions);
  });

  it("opens with the previously saved eligible stage", async () => {
    const h = buildRecordEditorHarness();
    const { result } = renderHook(() => h.useEditor(), { wrapper: h.wrapper });
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "product",
        unitId: PROJECT_ID,
      }),
    );
    act(() => enter(result.current, "Remember stage", ["Testing"]));
    act(() => result.current.record.submit());
    await settle();
    expect(result.current.record.state).toBeNull();
    expect(result.current.draft.stageMemory.recall(PROJECT_ID)).toBe("Testing");
    act(() =>
      result.current.record.open({
        kind,
        unitKind: "product",
        unitId: PROJECT_ID,
      }),
    );
    expect(result.current.record.state?.value.stageNames).toEqual(["Testing"]);
  });
});
