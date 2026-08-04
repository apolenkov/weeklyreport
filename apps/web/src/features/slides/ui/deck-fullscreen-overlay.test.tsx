// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeckFullscreenOverlay } from "./deck-fullscreen-overlay";

const noop = vi.fn();

describe("DeckFullscreenOverlay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when not fullscreen", () => {
    const { container } = render(
      <DeckFullscreenOverlay isFullscreen={false} onToggle={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the exit pill + a transient Esc hint in fullscreen, then auto-dismisses the hint", () => {
    vi.useFakeTimers();
    render(<DeckFullscreenOverlay isFullscreen={true} onToggle={noop} />);

    expect(
      screen.getByRole("button", { name: "Exit fullscreen" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("slide-esc-hint")).toHaveTextContent(
      "Press Esc to exit fullscreen",
    );

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // The hint TEXT auto-dismisses; the polite live region stays present but
    // empty (so screen readers reliably announce it), and the exit pill stays.
    expect(screen.getByTestId("slide-esc-hint")).toHaveTextContent("");
    expect(
      screen.getByRole("button", { name: "Exit fullscreen" }),
    ).toBeInTheDocument();
  });
});
