// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LockBadge } from "../report-shell/lock-badge";
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

// TASK-503.79 / C5298: the provider keeps its state until hide/scroll/resize and
// a removed anchor fires no mouseleave, so the tooltip must follow its owner.
describe("SdlcTooltipProvider anchor lifetime", () => {
  it("removes the lock badge tooltip when the hovered badge unmounts", async () => {
    const { rerender } = render(
      <SdlcTooltipProvider>
        <LockBadge authorName="Alice" />
      </SdlcTooltipProvider>,
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await screen.findByRole("tooltip");

    rerender(<SdlcTooltipProvider>{null}</SdlcTooltipProvider>);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it.each(["unmount", "mouseleave"])(
    "keeps the new owner's tooltip after the previous owner's %s",
    async (cleanup) => {
      const tree = (withAlice: boolean) => (
        <SdlcTooltipProvider>
          {withAlice ? <LockBadge key="alice" authorName="Alice" /> : null}
          <LockBadge key="bob" authorName="Bob" />
        </SdlcTooltipProvider>
      );
      const { rerender } = render(tree(true));
      const alice = screen.getByRole("img", { name: /authored by Alice/ });
      fireEvent.mouseEnter(alice);
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Alice");
      fireEvent.mouseEnter(
        screen.getByRole("img", { name: /authored by Bob/ }),
      );
      expect(screen.getByRole("tooltip")).toHaveTextContent("Bob");

      if (cleanup === "unmount") {
        rerender(tree(false));
      } else {
        fireEvent.mouseLeave(alice);
      }

      expect(screen.getByRole("tooltip")).toHaveTextContent("Bob");
      fireEvent.mouseLeave(
        screen.getByRole("img", { name: /authored by Bob/ }),
      );
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    },
  );

  it("keeps ownership through StrictMode rerenders and cleans up on removal", async () => {
    const tree = (authorName: string | null) => (
      <StrictMode>
        <SdlcTooltipProvider>
          {authorName ? <LockBadge authorName={authorName} /> : null}
        </SdlcTooltipProvider>
      </StrictMode>
    );
    const { rerender } = render(tree("Alice"));
    fireEvent.mouseEnter(screen.getByRole("img"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /^Read-only — authored by Alice · You can't edit this card$/,
    );

    rerender(tree("Alice Updated"));
    // The content captured at hover time stays for the old owner; a substring
    // match would also pass for the updated "Alice Updated" name.
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      /^Read-only — authored by Alice · You can't edit this card$/,
    );
    rerender(tree(null));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps another anchor's tooltip when an unrelated lock badge unmounts", async () => {
    const tree = (withBadge: boolean) => (
      <SdlcTooltipProvider>
        <TooltipProbe anchorRect={rect({ top: 100, left: 100 })} />
        {withBadge ? <LockBadge authorName="Alice" /> : null}
      </SdlcTooltipProvider>
    );
    const { rerender } = render(tree(true));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Show tooltip" }));
    await screen.findByRole("tooltip", { name: "probe tooltip" });

    rerender(tree(false));

    expect(
      screen.getByRole("tooltip", { name: "probe tooltip" }),
    ).toBeInTheDocument();
  });
});
