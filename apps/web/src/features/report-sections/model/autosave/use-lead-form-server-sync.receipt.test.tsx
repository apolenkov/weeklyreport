import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { makeDraftMergeSection } from "../lead-form/draft/lead-form-draft-merge-test-fixtures";
import { leadFormGenerationOf } from "../lead-form/lead-form-generation";
import { useLeadFormDraftCore } from "../lead-form/use-lead-form-draft-core";
import { confirmSavedRecord } from "./autosave-record-confirmation";
import { buildAutosaveHarness } from "./use-lead-form-autosave-harness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

it.each([true, false])(
  "requires the complete original response before recording a contextual receipt (whole reply: %s)",
  async (wholeReply) => {
    const server = makeDraftMergeSection();
    const harness = buildAutosaveHarness({
      mutationFn: (request) =>
        Promise.resolve({
          ...server,
          version: request.version + 1,
          items: wholeReply ? server.items : [],
          risks: server.risks.map((risk) => ({ ...risk, id: "reminted" })),
        }),
    });
    const generation = leadFormGenerationOf(server);
    const { result } = renderHook(
      () =>
        useLeadFormDraftCore({
          writePort: harness.writePort,
          generation,
          serverSection: server,
          sectionIdForActions: server.reportSectionId,
          serverReadOnly: false,
          refetchSection: vi.fn().mockResolvedValue(undefined),
        }),
      { wrapper: harness.wrapper },
    );
    const settled = vi.fn();
    act(() => {
      void result.current.savePersisted("original").then(settled);
    });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(harness.calls).toHaveLength(1);
    if (!wholeReply) {
      expect(result.current.lastSaveReceipt).toBeNull();
      expect(result.current.autosave.state).toBe("error");
      expect(result.current.saveRecovery?.phase).toBe("reconciliation");
      expect(settled).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: "accepted" }),
      );
      return;
    }
    const receipt = expectDefined(result.current.lastSaveReceipt);
    expect(
      confirmSavedRecord(receipt, {
        kind: "risk",
        stableId: expectDefined(server.risks[0]?.stableId),
        generation,
        reportSectionId: server.reportSectionId,
        scope: result.current.receiptScope,
        attemptToken: "original",
      }),
    ).toBe(true);
    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted", token: "original" }),
    );
  },
);
