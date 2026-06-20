/**
 * @vitest-environment jsdom
 */
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
    expect(screen.getByTestId("slide-esc-hint")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // The hint auto-dismisses; the persistent exit pill stays.
    expect(screen.queryByTestId("slide-esc-hint")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exit fullscreen" }),
    ).toBeInTheDocument();
  });
});
