import { describe, expect, it, vi } from "vitest";

import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { saveOverviewItem } from "./overview-item-save";
import {
  closeOverviewDialog,
  shouldResetSubmittedInput,
} from "./overview-item-submission";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

describe("unresolved receipt barrier at the shell boundary", () => {
  it("retains an unresolved editor even after its context detached", () => {
    const setDialog = vi.fn();
    const editor = {
      draft: { autosave: { state: "error" } },
    } as unknown as ReadyEditor;
    const dialog = {
      submission: { token: "original" },
    } as OverviewItemDialogState;
    closeOverviewDialog({
      editor,
      dialog,
      recoveryReason: "Context changed",
      setDialog,
    });
    expect(setDialog).not.toHaveBeenCalled();
  });

  it("releases the save barrier when a conflicted original is dismissed", () => {
    const setDialog = vi.fn();
    const abandonPersisted = vi.fn();
    const editor = {
      draft: {
        autosave: { state: "error" },
        saveRecovery: { phase: "reconciliation" },
        abandonPersisted,
      },
    } as unknown as ReadyEditor;
    const dialog = {
      submission: { token: "original" },
    } as OverviewItemDialogState;
    closeOverviewDialog({
      editor,
      dialog,
      recoveryReason: "Conflict",
      setDialog,
    });
    expect(abandonPersisted).toHaveBeenCalledWith("original");
    expect(setDialog).toHaveBeenCalledWith(null);
  });

  it("does not treat another Save as a reconstructed retry", () => {
    const setDialog = vi.fn();
    const setError = vi.fn();
    const editor = {
      draft: { autosave: { state: "error" } },
    } as unknown as ReadyEditor;
    const dialog = {
      mode: "edit",
      promotion: { pending: true },
      submission: { token: "original" },
    } as OverviewItemDialogState;
    saveOverviewItem(
      {
        editor,
        dialog,
        isReadOnly: false,
        recoveryReason: null,
        setDialog,
        setError,
        startedAttempt: { current: 1 },
        promotionAttempt: { current: null },
      },
      {} as Parameters<typeof saveOverviewItem>[1],
    );
    expect(setDialog).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining("not been confirmed"),
    );
  });
});

describe("confirmed add-another input", () => {
  it("preserves edits made after the submitted snapshot", () => {
    const submitted = { text: "first", stageNames: ["Build"] };
    expect(
      shouldResetSubmittedInput(submitted, { ...submitted, text: "next" }),
    ).toBe(false);
  });

  it("resets input when its values still match the submitted snapshot", () => {
    expect(
      shouldResetSubmittedInput(
        { text: "first", stageNames: ["Build"] },
        { text: "first", stageNames: ["Build"] },
      ),
    ).toBe(true);
  });
});
