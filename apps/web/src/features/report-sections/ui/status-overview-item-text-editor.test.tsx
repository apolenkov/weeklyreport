import { render, screen, waitFor } from "@testing-library/react";
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
  stageNames: [],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: null,
};

const TITLE_BUTTON = "Edit item: Original text";
const TEXT_FIELD = "Edit item text: Original text";

function editable(overrides: Partial<StatusOverviewItem> = {}) {
  return { item: { ...item, ...overrides }, onEditItemText: vi.fn() };
}

describe("StatusOverviewItemPreview inline text editing", () => {
  it("opens the textarea in place on a text click and Enter saves it", async () => {
    const user = userEvent.setup();
    const { item: editableItem, onEditItemText } = editable();
    render(
      <StatusOverviewItemPreview
        item={editableItem}
        onEditItem={vi.fn()}
        onEditItemText={onEditItemText}
      />,
    );

    await user.click(screen.getByRole("button", { name: TITLE_BUTTON }));
    const field = screen.getByRole("textbox", { name: TEXT_FIELD });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, "Edited text{Enter}");

    expect(onEditItemText).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "Edited text",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: TITLE_BUTTON }),
    ).toBeInTheDocument();
  });

  it("Esc cancels without a write and restores the shown text", async () => {
    const user = userEvent.setup();
    const { item: editableItem, onEditItemText } = editable();
    render(
      <StatusOverviewItemPreview
        item={editableItem}
        onEditItemText={onEditItemText}
      />,
    );

    await user.click(screen.getByRole("button", { name: TITLE_BUTTON }));
    const field = screen.getByRole("textbox", { name: TEXT_FIELD });
    await user.type(field, " abandoned");
    await user.keyboard("{Escape}");

    expect(onEditItemText).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Original text")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: TITLE_BUTTON })).toHaveFocus(),
    );
  });

  it("Shift+Enter inserts a line break without saving", async () => {
    const user = userEvent.setup();
    const { item: editableItem, onEditItemText } = editable();
    render(
      <StatusOverviewItemPreview
        item={editableItem}
        onEditItemText={onEditItemText}
      />,
    );

    await user.click(screen.getByRole("button", { name: TITLE_BUTTON }));
    const field = screen.getByRole("textbox", { name: TEXT_FIELD });
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(field, "second line");

    expect(onEditItemText).not.toHaveBeenCalled();
    expect(field).toHaveValue("Original text\nsecond line");
    expect(screen.getByRole("textbox")).toBe(field);
  });

  it("a blank commit emits no write and restores the previous text", async () => {
    const user = userEvent.setup();
    const { item: editableItem, onEditItemText } = editable();
    render(
      <StatusOverviewItemPreview
        item={editableItem}
        onEditItemText={onEditItemText}
      />,
    );

    await user.click(screen.getByRole("button", { name: TITLE_BUTTON }));
    const field = screen.getByRole("textbox", { name: TEXT_FIELD });
    await user.clear(field);
    await user.type(field, "   {Enter}");

    expect(onEditItemText).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Original text")).toBeInTheDocument();
  });

  it("clicking outside saves non-empty trimmed text", async () => {
    const user = userEvent.setup();
    const { item: editableItem, onEditItemText } = editable();
    render(
      <div>
        <StatusOverviewItemPreview
          item={editableItem}
          onEditItemText={onEditItemText}
        />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: TITLE_BUTTON }));
    const field = screen.getByRole("textbox", { name: TEXT_FIELD });
    await user.clear(field);
    await user.type(field, "  New text  ");
    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(onEditItemText).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "New text",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps text clicks on the canonical editor when the target edits the next step", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    const onEditItemText = vi.fn();
    const linked = {
      ...item,
      source: "next" as const,
      editTarget: {
        recordId: "item-1",
        source: "current" as const,
        focusNextStep: true,
      },
    };
    render(
      <StatusOverviewItemPreview
        item={linked}
        onEditItem={onEditItem}
        onEditItemText={onEditItemText}
      />,
    );

    await user.click(screen.getByRole("button", { name: TITLE_BUTTON }));
    expect(onEditItem).toHaveBeenCalledWith(linked.editTarget);
    expect(onEditItemText).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("offers no inline editor on read-only items", async () => {
    const user = userEvent.setup();
    const onEditItemText = vi.fn();
    const { container } = render(
      <StatusOverviewItemPreview
        item={{ ...item, source: "previous", editTarget: null }}
        onEditItemText={onEditItemText}
      />,
    );

    const text = screen.getByText("Original text");
    expect(text.tagName).toBe("P");
    await user.click(text);
    expect(container.querySelector("textarea")).toBeNull();
    expect(onEditItemText).not.toHaveBeenCalled();
  });

  it("keeps a completed item's text non-interactive", async () => {
    const user = userEvent.setup();
    const onEditItemText = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, workflowStatus: "done" }}
        onEditItem={vi.fn()}
        onEditItemText={onEditItemText}
      />,
    );

    const text = screen.getByText("Original text");
    expect(text.tagName).toBe("P");
    await user.click(text);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onEditItemText).not.toHaveBeenCalled();
  });
});
