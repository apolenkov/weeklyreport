import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { SaveNowButton } from "./save-now-button";
import type { AutosaveSnapshot } from "../../hooks/use-lead-form-autosave";

function makeSnapshot(
  overrides: Partial<AutosaveSnapshot> = {},
): AutosaveSnapshot {
  return {
    state: "idle",
    lastSavedAt: null,
    dirty: false,
    isInFlight: false,
    forceSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SaveNowButton", () => {
  it("renders 'Save now' label in idle/pending/error states", () => {
    const { rerender } = render(
      <SaveNowButton autosave={makeSnapshot({ state: "idle" })} />,
    );
    expect(screen.getByRole("button", { name: /save draft now/i })).toBeDefined();

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    expect(screen.getByRole("button", { name: /save draft now/i })).toBeDefined();
  });

  it("is enabled only when state is pending or error", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "error", dirty: true })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <SaveNowButton autosave={makeSnapshot({ state: "idle" })} />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows 'Saving…' label and is disabled while isInFlight=true", () => {
    render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect(screen.getByRole("button", { name: /saving draft/i })).toBeDefined();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows '✓ Saved' for ~1500ms after state transitions to saved, then reverts", async () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );

    // Simulate mutation completing: state=saved, isInFlight=false.
    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saved", dirty: false, isInFlight: false })}
      />,
    );

    // Immediately after success the button should show "Saved".
    expect(screen.getByRole("button", { name: /draft saved/i })).toBeDefined();
    expect(screen.getByText("Saved")).toBeDefined();

    // After 1500ms the label should revert.
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // After revert button aria-label should be back to "Save draft now".
    // The button is now disabled (state=saved) so label reverts to "Save now".
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("Save draft now");
  });

  it("calls forceSave when clicked in pending state", async () => {
    const forceSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true, forceSave })}
      />,
    );

    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await act(async () => {
      btn.click();
    });
    expect(forceSave).toHaveBeenCalledOnce();
  });

  it("does not call forceSave when button is disabled (idle state)", async () => {
    const forceSave = vi.fn();
    render(
      <SaveNowButton autosave={makeSnapshot({ state: "idle", forceSave })} />,
    );

    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // Click on a disabled button should not trigger handler.
    btn.click();
    expect(forceSave).not.toHaveBeenCalled();
  });
});
