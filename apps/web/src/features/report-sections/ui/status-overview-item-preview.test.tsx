import { fireEvent, render, screen } from "@testing-library/react";
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
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};

describe("StatusOverviewItemPreview quick edit", () => {
  it("keeps historical text read-only even when row handlers are available", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, source: "previous", editTarget: null }}
        onQuickEditText={vi.fn()}
      />,
    );

    expect(screen.getByText("Original text")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quick edit/ })).toBeNull();
  });

  it("edits the text inline and saves through onQuickEditText", async () => {
    const user = userEvent.setup();
    const onQuickEditText = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItem={vi.fn()}
        onQuickEditText={onQuickEditText}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Quick edit Original text/ }),
    );
    const textarea = screen.getByRole("textbox", {
      name: /Edit update text: Original text/,
    });
    await user.clear(textarea);
    await user.type(textarea, "Updated text");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onQuickEditText).toHaveBeenCalledWith(item, "Updated text");
  });

  it("removes the quick edit form when the item becomes read-only", async () => {
    const user = userEvent.setup();
    const onQuickEditText = vi.fn();
    const { rerender } = render(
      <StatusOverviewItemPreview
        item={item}
        onQuickEditText={onQuickEditText}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Quick edit/ }));

    rerender(
      <StatusOverviewItemPreview
        item={{ ...item, editTarget: null }}
        onQuickEditText={onQuickEditText}
      />,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(onQuickEditText).not.toHaveBeenCalled();
  });

  it("cancels with Escape without saving", async () => {
    const user = userEvent.setup();
    const onQuickEditText = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItem={vi.fn()}
        onQuickEditText={onQuickEditText}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Quick edit/ }));
    await user.keyboard("{Escape}");

    expect(onQuickEditText).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Quick edit Original text/ }),
    ).toHaveFocus();
  });

  it("retains typed text across a same-item refresh and cancels to refreshed text", async () => {
    const user = userEvent.setup();
    const onQuickEditText = vi.fn();
    const { rerender } = render(
      <StatusOverviewItemPreview
        item={item}
        onQuickEditText={onQuickEditText}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Quick edit/ }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Unsaved local text");

    rerender(
      <StatusOverviewItemPreview
        item={{ ...item, text: "Refreshed text" }}
        onQuickEditText={onQuickEditText}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Unsaved local text");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onQuickEditText).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Quick edit Refreshed text" }),
    ).toBeInTheDocument();
  });

  it("opens the same canonical target from the active title and visible Edit action", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(<StatusOverviewItemPreview item={item} onEditItem={onEditItem} />);

    const title = screen.getByRole("button", {
      name: "Edit item: Original text",
    });
    expect(title).toHaveClass("min-h-[var(--touch-target-min)]");
    await user.click(title);
    await user.click(
      screen.getByRole("button", { name: "Edit update: Original text" }),
    );

    expect(onEditItem).toHaveBeenCalledTimes(2);
    expect(onEditItem.mock.calls[0]?.[0]).toBe(item.editTarget);
    expect(onEditItem.mock.calls[1]?.[0]).toBe(item.editTarget);
  });

  it("keeps Move and audited outcomes in labelled menus", async () => {
    const user = userEvent.setup();
    const onResolvePlan = vi.fn();
    const onMoveItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onMoveItem={onMoveItem}
        onResolvePlan={onResolvePlan}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Edit update: Original text" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Move Original text" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Move to next week" }),
    );
    expect(onMoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Original text" }),
      "next",
      "move:current:stable-1",
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Update status" }));
    expect(onResolvePlan).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Original text" }),
      "resolve:current:stable-1",
    );
  });

  it("plans an unfinished prior-only lineage while keeping its title read-only", async () => {
    const user = userEvent.setup();
    const previous = {
      ...item,
      source: "previous" as const,
      editTarget: null,
      canResolve: true,
    };
    const onPlanItem = vi.fn();
    const onResolvePlan = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={previous}
        onPlanItem={onPlanItem}
        onResolvePlan={onResolvePlan}
      />,
    );

    expect(screen.getByText("Original text").tagName).toBe("P");
    await user.click(screen.getByRole("button", { name: "Plan this work" }));
    expect(onPlanItem).toHaveBeenCalledWith(previous);
    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Update status" }));
    expect(onResolvePlan).toHaveBeenCalledWith(
      previous,
      "resolve:previous:stable-1",
    );
  });

  it("keeps the row actions off the update text so nothing is covered", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onQuickEditText={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    const text = screen.getByRole("button", {
      name: "Quick edit Original text",
    });
    const cluster = document.querySelector("[data-overview-item-actions]");
    expect(cluster).not.toBeNull();
    // The actions share the metadata line instead of overlaying the text.
    expect(cluster).not.toHaveClass("absolute");
    expect(text.contains(cluster)).toBe(false);
    expect(cluster?.previousElementSibling?.textContent).toContain(
      "In progress",
    );
    // Hidden until hover or focus, and always visible where hover cannot exist.
    expect(cluster).not.toHaveClass("opacity-0");
    expect(cluster?.className).not.toContain("group-hover/item:opacity-100");
    expect(cluster?.className).not.toContain(
      "group-focus-within/item:opacity-100",
    );
    expect(text).toHaveClass("w-[calc(100%+0.5rem)]");
  });

  it("leaves Escape to an active IME composition", async () => {
    const user = userEvent.setup();
    render(<StatusOverviewItemPreview item={item} onQuickEditText={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Quick edit/ }));
    const textarea = screen.getByRole("textbox");
    // IME composition in progress: Escape cancels the composition, not the edit.
    fireEvent.keyDown(textarea, { key: "Escape", isComposing: true });
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // A finished composition leaves Escape closing the editor again.
    fireEvent.keyDown(textarea, { key: "Escape", isComposing: false });
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps the floating actions keyboard reachable while hidden", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onQuickEditText={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Quick edit Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit update: Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "More actions for Original text" }),
    ).toHaveFocus();
  });
});
