// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider, useSdlcTooltip } from "./sdlc-tooltip";

function rect({
  top,
  left = 0,
  width = 40,
  height = 20,
}: {
  readonly top: number;
  readonly left?: number;
  readonly width?: number;
  readonly height?: number;
}): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top,
  };
}

function TooltipProbe({ anchorRect }: { readonly anchorRect: DOMRect }) {
  const tooltip = useSdlcTooltip();
  return (
    <button
      type="button"
      onMouseEnter={() => tooltip.show(anchorRect, "probe tooltip")}
    >
      Show tooltip
    </button>
  );
}

describe("SdlcTooltipProvider positioning", () => {
  it("flips below a top-edge anchor and clamps the horizontal center", async () => {
    vi.stubGlobal("innerHeight", 160);
    vi.stubGlobal("innerWidth", 200);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRect(this: HTMLElement) {
        if (this.dataset.testid === "sdlc-tooltip") {
          return rect({ top: 0, left: 0, width: 120, height: 40 });
        }
        return rect({ top: 0 });
      },
    );

    render(
      <SdlcTooltipProvider>
        <TooltipProbe anchorRect={rect({ top: 4, left: -20 })} />
      </SdlcTooltipProvider>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Show tooltip" }));

    const tooltip = await screen.findByRole("tooltip", {
      name: "probe tooltip",
    });
    await waitFor(() => {
      expect(tooltip).toHaveAttribute("data-placement", "below");
      expect(tooltip).toHaveStyle({ top: "32px", left: "68px" });
    });
    expect(tooltip.parentElement).toBe(document.body);
  });

  it("hides on native scroll and removes listeners after cleanup", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    render(
      <SdlcTooltipProvider>
        <TooltipProbe anchorRect={rect({ top: 100, left: 100 })} />
      </SdlcTooltipProvider>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Show tooltip" }));
    await screen.findByRole("tooltip", { name: "probe tooltip" });

    expect(addEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      true,
    );
    expect(addEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );

    fireEvent.scroll(window);
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      true,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Show tooltip" }));
    await screen.findByRole("tooltip", { name: "probe tooltip" });
    fireEvent(window, new Event("resize"));
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
  });
});
