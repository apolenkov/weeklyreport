import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LockBadge } from "./lock-badge";

vi.mock("../sdlc-tooltip", () => ({
  useSdlcTooltip: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })),
}));

// Import after the mock is registered so the mock is in place.
const { useSdlcTooltip } = await import("../sdlc-tooltip");

describe("LockBadge", () => {
  it("outer div has role='img'", () => {
    render(<LockBadge authorName="Alice" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("outer div has no tabindex attribute (removed from tab order)", () => {
    const { container } = render(<LockBadge authorName="Alice" />);
    const div = container.firstChild as HTMLElement;
    expect(div.hasAttribute("tabindex")).toBe(false);
  });

  it("outer div aria-label matches /Read-only — authored by/", () => {
    render(<LockBadge authorName="Alice" />);
    const el = screen.getByRole("img");
    expect(el).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Read-only — authored by/),
    );
  });

  it("outer div aria-label includes the supplied authorName", () => {
    render(<LockBadge authorName="Alice" />);
    const el = screen.getByRole("img");
    expect(el).toHaveAttribute("aria-label", "Read-only — authored by Alice");
  });

  it("uses theme-aware surface tokens for its border and background", () => {
    render(<LockBadge authorName="Alice" />);
    expect(screen.getByRole("img")).toHaveClass(
      "border-[var(--color-border)]",
      "bg-[var(--color-card)]",
    );
  });

  it("accessible name is surfaced via getByRole('img', { name })", () => {
    render(<LockBadge authorName="Alice" />);
    expect(
      screen.getByRole("img", { name: /Read-only — authored by/ }),
    ).toBeInTheDocument();
  });

  it("lock-badge div is skipped by Tab (keyboard not focusable)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>preceding</button>
        <LockBadge authorName="Alice" />
      </>,
    );
    // Focus the preceding button first, then Tab forward.
    const btn = screen.getByRole("button", { name: "preceding" });
    btn.focus();
    await user.tab();
    // After Tab, focus must NOT land on the lock-badge div (no tabIndex).
    const badge = screen.getByRole("img", { name: /Read-only — authored by/ });
    expect(document.activeElement).not.toBe(badge);
  });

  it("mouseEnter shows the same lock description as the accessible name", () => {
    const showSpy = vi.fn();
    const hideSpy = vi.fn();
    // Use mockReturnValue (not Once) so StrictMode double-render does not exhaust the stub.
    vi.mocked(useSdlcTooltip).mockReturnValue({
      show: showSpy,
      hide: hideSpy,
    });
    render(<LockBadge authorName="Alice" />);
    const lockDescription = "Read-only — authored by Alice";
    const badge = screen.getByRole("img", { name: lockDescription });

    fireEvent.mouseEnter(badge);
    expect(showSpy).toHaveBeenCalledWith(
      expect.anything(),
      `${lockDescription} · You can't edit this card`,
    );

    fireEvent.mouseLeave(badge);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });
});
