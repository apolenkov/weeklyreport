import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

const item: StatusOverviewItem = {
  key: "item-1",
  recordId: "item-1",
  source: "current",
  editTarget: { recordId: "item-1", source: "current" },
  stableId: "stable-1",
  text: "Original text",
  tag: "feature",
  stageNames: ["Development"],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};

const STATUS_BUTTON = "Status of Original text: In progress";

describe("StatusOverviewItemPreview reveal and keyboard", () => {
  const handlers = {
    onEditItem: vi.fn(),
    onMoveItem: vi.fn(),
    onResolvePlan: vi.fn(),
    onSetStatus: vi.fn(),
  };

  it("hides the action chip with opacity only, never from the tree", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    const chip = document.querySelector("[data-overview-item-actions]");
    expect(chip).not.toBeNull();
    const classes = chip?.className ?? "";
    expect(classes).toContain("opacity-0");
    // Revealed on hover, focus within, an open menu, and where hover cannot exist.
    expect(classes).toContain("group-hover/item:opacity-100");
    expect(classes).toContain("group-focus-within/item:opacity-100");
    expect(classes).toContain("has-[[data-state=open]]:opacity-100");
    expect(classes).toContain("[@media(hover:none)]:opacity-100");
    for (const hiding of ["hidden", "invisible", "sr-only"]) {
      expect(chip).not.toHaveClass(hiding);
    }
    // Still reachable by name while visually hidden; compact on pointers,
    // full touch target where a finger has no hover to reveal the chip.
    const more = within(chip as HTMLElement).getByRole("button", {
      name: "More actions for Original text",
    });
    expect(more).toHaveClass("h-7");
    expect(more).toHaveClass("w-7");
    expect(more).toHaveClass(
      "[@media(hover:none)]:min-h-[var(--touch-target-min)]",
    );
    expect(more).toHaveClass(
      "[@media(hover:none)]:min-w-[var(--touch-target-min)]",
    );
  });

  it("floats the chip over the card so the text keeps the full width", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    const card = document.querySelector<HTMLElement>(
      "[data-overview-item-preview]",
    );
    expect(card).toHaveClass("relative");
    const chip = document.querySelector<HTMLElement>(
      "[data-overview-item-actions]",
    );
    expect(chip).not.toBeNull();
    expect(chip).toHaveClass("absolute");
    expect(chip).toHaveClass("top-0");
    expect(chip).toHaveClass("right-0");
    expect(chip).toHaveClass("bg-[var(--color-card)]");
  });

  it("gives every control the touch target size where hover cannot exist", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    // Inline controls keep the full touch target; the chip's compact
    // pointer buttons carry it under the no-hover media query.
    for (const button of screen.getAllByRole("button")) {
      const classes = button.className;
      expect(
        classes.includes("min-h-[var(--touch-target-min)]") ||
          classes.includes(
            "[@media(hover:none)]:min-h-[var(--touch-target-min)]",
          ),
      ).toBe(true);
    }
  });

  it("tabs through the status icon and the text, then the chip's grip and actions", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: STATUS_BUTTON })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit item: Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Drag to move to another week" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Move Original text to next week" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Comments on Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "More actions for Original text" }),
    ).toHaveFocus();
  });

  it("opens the overflow on a touch tap", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", {
        name: "More actions for Original text",
      }),
    });
    expect(
      screen.getByRole("menuitem", { name: "Edit details: Original text" }),
    ).toBeInTheDocument();
  });
});
