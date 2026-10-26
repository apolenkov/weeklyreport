import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../icons/action-icons", () => ({
  CheckIcon: ({ className }: { readonly className?: string }) => (
    <svg data-testid="shared-action-check" className={className} />
  ),
}));

import { SaveNowButton, type SaveNowButtonState } from "./save-now-button";

type SnapshotFixture = SaveNowButtonState & {
  readonly lastSavedAt: Date | null;
  readonly dirty: boolean;
};

function makeSnapshot(
  overrides: Partial<SnapshotFixture> = {},
): SnapshotFixture {
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
  it("renders aria-label 'Save draft now' in idle and pending states", () => {
    const { rerender } = render(
      <SaveNowButton autosave={makeSnapshot({ state: "idle" })} />,
    );
    expect(
      screen.getByRole("button", { name: /save draft now/i }),
    ).toBeDefined();

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    expect(
      screen.getByRole("button", { name: /save draft now/i }),
    ).toBeDefined();
  });

  it("renders the visible label text matching the current state — not icon-only", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    expect(screen.getByText("Save")).toBeDefined();

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect(screen.getByText("Saving")).toBeDefined();

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );
    expect(screen.getByText("Saved")).toBeDefined();

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "error", dirty: true })}
      />,
    );
    expect(screen.getByText("Retry")).toBeDefined();
  });

  it("is enabled only when state is pending or error", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(false);

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "error", dirty: true })}
      />,
    );
    expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(false);

    rerender(<SaveNowButton autosave={makeSnapshot({ state: "idle" })} />);
    expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(true);

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(true);
  });

  it("shows spinner icon and aria-label 'Saving draft' while in flight", () => {
    render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect(screen.getByRole("button", { name: /saving draft/i })).toBeDefined();
    // Spinner is identified by a stable data attribute.
    expect(screen.getByTestId("save-now-spinner")).toBeDefined();
  });

  it("shows check icon for ~1500ms after success, then reverts to disc + 'Save draft now'", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /draft saved/i })).toBeDefined();
    expect(screen.getByTestId("save-now-check")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const btn = screen.getByRole<HTMLButtonElement>("button");
    expect(btn.getAttribute("aria-label")).toBe("Save draft now");
    expect(screen.getByTestId("save-now-disc")).toBeDefined();
  });

  it("keeps the normal Save control mounted after retry success and its Saved flash", async () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "error", dirty: true })}
      />,
    );
    const retry = screen.getByRole("button", { name: "Retry saving draft" });
    retry.focus();
    rerender(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );
    expect(screen.getByRole("button", { name: "Saving draft" })).toBe(retry);
    rerender(<SaveNowButton autosave={makeSnapshot({ state: "saved" })} />);
    expect(screen.getByRole("button", { name: "Draft saved" })).toBe(retry);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByRole("button", { name: "Save draft now" })).toBe(retry);
    expect(retry).toHaveFocus();
    expect(retry).toBeDisabled();
  });

  it.each(["idle", "pending", "saving", "saved"] as const)(
    "hides retry-only controls before an error even for %s autosave",
    (state) => {
      render(
        <SaveNowButton
          autosave={makeSnapshot({ state, isInFlight: state === "saving" })}
          retryOnly
        />,
      );
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  it("renders the canonical shared check icon with saved-state sizing and color", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );

    const sharedCheck = screen.getByTestId("shared-action-check");
    expect(screen.getByTestId("save-now-check")).toContainElement(sharedCheck);
    expect(sharedCheck).toHaveClass(
      "h-[14px]",
      "w-[14px]",
      "text-[var(--color-success-foreground)]",
    );
  });

  it("clears the saved indicator synchronously when state leaves saved before the revert timer", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /draft saved/i })).toBeDefined();
    expect(screen.getByTestId("save-now-check")).toBeDefined();

    // New edit before 1500ms — must clear without advancing fake timers.
    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "pending",
          dirty: true,
          isInFlight: false,
        })}
      />,
    );

    expect(screen.queryByTestId("save-now-check")).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button").getAttribute("aria-label"),
    ).toBe("Save draft now");
  });

  it("clears the saved indicator synchronously on error before the revert timer", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );

    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );

    expect(screen.getByTestId("save-now-check")).toBeDefined();

    // Failed save before 1500ms — must clear without advancing fake timers.
    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "error",
          dirty: true,
          isInFlight: false,
        })}
      />,
    );

    expect(screen.queryByTestId("save-now-check")).toBeNull();
    expect(screen.getByTestId("save-now-alert")).toBeDefined();
  });

  it("calls forceSave when clicked in pending state", async () => {
    const forceSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "pending",
          dirty: true,
          forceSave,
        })}
      />,
    );

    const btn = screen.getByRole<HTMLButtonElement>("button");
    expect(btn.disabled).toBe(false);
    await act(() => {
      btn.click();
      return Promise.resolve();
    });
    expect(forceSave).toHaveBeenCalledOnce();
  });

  it("does not call forceSave when button is disabled (idle state)", () => {
    const forceSave = vi.fn();
    render(
      <SaveNowButton autosave={makeSnapshot({ state: "idle", forceSave })} />,
    );

    const btn = screen.getByRole<HTMLButtonElement>("button");
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(forceSave).not.toHaveBeenCalled();
  });

  it("saving/in-flight render: spinner + aria-busy=true + accent fill + disabled", () => {
    render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "saving", isInFlight: true })}
      />,
    );

    expect(screen.getByTestId("save-now-spinner")).toBeDefined();

    const btn = screen.getByRole<HTMLButtonElement>("button");
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.className).toContain("bg-[var(--color-starbucks-accent)]");
    expect(btn.className).toContain("text-[var(--color-primary-foreground)]");
    expect(btn.disabled).toBe(true);
  });

  it.each([
    { state: "idle" as const, isInFlight: false, dirty: false },
    { state: "pending" as const, isInFlight: false, dirty: true },
    { state: "error" as const, isInFlight: false, dirty: true },
  ])(
    "settled state $state: aria-busy=false, no accent fill",
    ({ state, isInFlight, dirty }) => {
      render(
        <SaveNowButton autosave={makeSnapshot({ state, isInFlight, dirty })} />,
      );

      const btn = screen.getByRole<HTMLButtonElement>("button");
      expect(btn.getAttribute("aria-busy")).toBe("false");
      expect(btn.className).not.toContain("bg-[var(--color-starbucks-accent)]");
    },
  );

  it("settled saved state: aria-busy=false, no accent fill", () => {
    const { rerender } = render(
      <SaveNowButton
        autosave={makeSnapshot({ state: "pending", dirty: true })}
      />,
    );
    rerender(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saved",
          dirty: false,
          isInFlight: false,
        })}
      />,
    );

    const btn = screen.getByRole<HTMLButtonElement>("button");
    expect(btn.getAttribute("aria-busy")).toBe("false");
    expect(btn.className).not.toContain("bg-[var(--color-starbucks-accent)]");
  });

  it("does not call forceSave when disabled in saving state (repeat-click guard)", () => {
    const forceSave = vi.fn();
    render(
      <SaveNowButton
        autosave={makeSnapshot({
          state: "saving",
          isInFlight: true,
          forceSave,
        })}
      />,
    );

    const btn = screen.getByRole<HTMLButtonElement>("button");
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(forceSave).not.toHaveBeenCalled();
  });
});
