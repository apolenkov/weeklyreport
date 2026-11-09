import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { useOverviewSubmissionDriver } from "./overview-item-submission";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

vi.mock("./overview-editor-recovery", () => ({
  overviewAcknowledgedItem: (editor: { acknowledged: boolean }) =>
    editor.acknowledged ? { stableId: "saved", week: "current" } : undefined,
}));

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

describe("receipt with newer create input", () => {
  it.each([false, true])(
    "retains newer input after receipt (addAnother=%s)",
    async (addAnother) => {
      let resolveReceipt!: () => void;
      const receipt = new Promise<void>((resolve) => {
        resolveReceipt = resolve;
      });
      const snapshot = { text: "submitted" };
      let input = snapshot;
      let editor = {
        generation: "generation",
        acknowledged: false,
        draft: {
          receiptScope: "scope",
          autosave: { state: "idle", dirty: false, isInFlight: false },
        },
      } as unknown as ReadyEditor & { acknowledged: boolean };
      const initial = {
        mode: "create",
        generation: "generation",
        week: "current",
        target: { source: "current", unitKind: "product", unitId: "product" },
        draftStore: { getSnapshot: () => input },
        submission: {
          attempt: 1,
          receiptScope: "scope",
          saveArmed: true,
          activityObserved: true,
          addAnother,
          inputSnapshot: snapshot,
        },
      } as unknown as OverviewItemDialogState;
      const startedAttempt = { current: 1 as number | null };
      const createdFocus = { current: null };
      const { result, rerender } = renderHook(() => {
        const [dialog, setDialog] = useState<OverviewItemDialogState | null>(
          initial,
        );
        useOverviewSubmissionDriver({
          editor,
          dialog,
          setDialog,
          recoveryReason: null,
          startedAttempt,
          createdFocus,
        });
        return dialog;
      });
      input = { text: "newer" };
      await act(async () => {
        resolveReceipt();
        await receipt;
        editor = { ...editor, acknowledged: true };
        rerender();
      });
      expect(result.current?.draftStore.getSnapshot()).toEqual({
        text: "newer",
      });
      expect(result.current?.submission).toBeNull();
      expect(createdFocus.current).toBeNull();
    },
  );
});
