// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SlideFullscreenButton } from "./slide-fullscreen-button";

const noop = vi.fn();

describe("SlideFullscreenButton (presentational)", () => {
  it("exposes toggle state via aria-pressed and flips the label/icon", () => {
    const { rerender } = render(
      <SlideFullscreenButton isFullscreen={false} onToggle={noop} />,
    );
    const enter = screen.getByRole("button", { name: "Enter fullscreen" });
    expect(enter).toHaveAttribute("aria-pressed", "false");

    rerender(<SlideFullscreenButton isFullscreen={true} onToggle={noop} />);
    const exit = screen.getByRole("button", { name: "Exit fullscreen" });
    expect(exit).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle exactly once when clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<SlideFullscreenButton isFullscreen={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("floating variant self-gates: renders nothing unless fullscreen", () => {
    const { rerender, container } = render(
      <SlideFullscreenButton
        isFullscreen={false}
        onToggle={noop}
        variant="floating"
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <SlideFullscreenButton
        isFullscreen={true}
        onToggle={noop}
        variant="floating"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Exit fullscreen" }),
    ).toBeInTheDocument();
  });
});
