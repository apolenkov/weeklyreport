import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AutosaveSnapshot } from "../../../../report-sections/client";
import {
  SAVE_FAILURE_TOAST_ID,
  useSaveFailureNotice,
} from "./use-save-failure-notice";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), dismiss: vi.fn() },
}));

function autosave(state: AutosaveSnapshot["state"]): AutosaveSnapshot {
  return {
    state,
    lastSavedAt: null,
    dirty: state === "error",
    currentPayloadMatchesSavedBaseline: state !== "error",
    isInFlight: false,
    forceSave: vi.fn(() => Promise.resolve()),
  };
}

afterEach(() => vi.clearAllMocks());

describe("useSaveFailureNotice", () => {
  it("raises one persistent Retry notice while autosave has failed", () => {
    const failed = autosave("error");
    renderHook(() => useSaveFailureNotice(failed, true));
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast.error).mock.calls[0] ?? [];
    expect(message).toBe("Draft not saved");
    expect(options).toMatchObject({
      id: SAVE_FAILURE_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
    });
    const action = options?.action;
    if (!action || typeof action !== "object" || !("onClick" in action))
      throw new Error("Retry action missing");
    expect(action.label).toBe("Retry");
    action.onClick({} as never);
    expect(failed.forceSave).toHaveBeenCalledTimes(1);
  });

  it("dismisses the notice once the draft saves again", () => {
    const { rerender } = renderHook(
      ({ snapshot }) => useSaveFailureNotice(snapshot, true),
      { initialProps: { snapshot: autosave("error") } },
    );
    rerender({ snapshot: autosave("saved") });
    expect(toast.dismiss).toHaveBeenCalledWith(SAVE_FAILURE_TOAST_ID);
  });

  it("stays silent where the draft is not editable", () => {
    renderHook(() => useSaveFailureNotice(autosave("error"), false));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
