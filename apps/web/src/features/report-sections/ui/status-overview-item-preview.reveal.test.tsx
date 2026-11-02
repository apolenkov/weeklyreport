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
    onSetStages: vi.fn(),
    ownedStages: ["Development", "Testing"],
  };

  it("hides the action row with opacity only, never from the tree", () => {
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
    // full touch target where a finger has no hover to reveal the row.
    const more = within(chip as HTMLElement).getByRole("button", {
      name: "Edit details: Original text",
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

  it("keeps the action row in its own column so revealing it never covers the text", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    const row = document.querySelector<HTMLElement>(
      "[data-overview-item-actions]",
    );
    expect(row).not.toBeNull();
    // In flow beside the text, never floated over it; on touch it wraps below.
    expect(row).not.toHaveClass("absolute");
    expect(row).toHaveClass("shrink-0");
    expect(row).toHaveClass("[@media(hover:none)]:w-full");
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

  it("tabs through the status icon and the text, then the row's actions", async () => {
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
      screen.getByRole("button", { name: "Move Original text to next week" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Stages for Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Comments on Original text" }),
    ).toHaveFocus();
    // No drag handle and no overflow menu follow the flat row.
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("runs a row action on a touch tap", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
        onEditItem={onEditItem}
      />,
    );

    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", {
        name: "Edit details: Original text",
      }),
    });
    expect(onEditItem).toHaveBeenCalledWith(item.editTarget);
  });
});
