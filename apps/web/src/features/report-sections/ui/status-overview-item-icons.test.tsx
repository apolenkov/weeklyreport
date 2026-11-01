import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RecordCommentView } from "@weeklyreport/shared";
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

const nextItem: StatusOverviewItem = {
  ...item,
  source: "next",
  workflowStatus: "planned",
  editTarget: { recordId: "item-1", source: "next" },
  continuity: null,
};

const projection: StatusOverviewItem = {
  ...nextItem,
  editTarget: { recordId: "item-1", source: "current", focusNextStep: true },
};

const previousItem: StatusOverviewItem = {
  ...item,
  source: "previous",
  editTarget: null,
  continuity: null,
};

const COMMENT: RecordCommentView = {
  id: "33333333-3333-4333-8333-333333333333",
  reviewerId: "22222222-2222-4222-8222-222222222222",
  reviewerName: "Head Reviewer",
  text: "Please split this item.",
  createdAt: new Date("2026-07-01T10:00:00Z"),
};

function focusCard(): void {
  const card = document.querySelector<HTMLElement>(
    "[data-overview-item-preview]",
  );
  card?.focus();
}

describe("StatusOverviewItemPreview hover action icons", () => {
  it("shows the week-move icon toward the other active week", () => {
    const current = render(
      <StatusOverviewItemPreview item={item} onMoveItem={vi.fn()} />,
    );
    const moveIcon = screen.getByRole("button", {
      name: "Move Original text to next week",
    });
    expect(moveIcon).toHaveClass("min-h-[var(--touch-target-min)]");
    current.unmount();

    render(<StatusOverviewItemPreview item={nextItem} onMoveItem={vi.fn()} />);
    expect(
      screen.getByRole("button", {
        name: "Move Original text to current week",
      }),
    ).toBeInTheDocument();
  });

  it("moves from the icon and still offers the move in the overflow menu", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(<StatusOverviewItemPreview item={item} onMoveItem={onMoveItem} />);

    await user.click(
      screen.getByRole("button", { name: "Move Original text to next week" }),
    );
    expect(onMoveItem).toHaveBeenLastCalledWith(
      item,
      "next",
      "move:current:stable-1",
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: "Move to next week: Original text",
      }),
    );
    expect(onMoveItem).toHaveBeenLastCalledWith(
      item,
      "next",
      "more:current:stable-1",
    );
  });

  it("moves a Next item back to Current from the icon", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(
      <StatusOverviewItemPreview item={nextItem} onMoveItem={onMoveItem} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Move Original text to current week",
      }),
    );
    expect(onMoveItem).toHaveBeenLastCalledWith(
      nextItem,
      "current",
      "move:next:stable-1",
    );
  });

  it("withholds the week-move icon where the move is forbidden", () => {
    const done = render(
      <StatusOverviewItemPreview
        item={{ ...item, workflowStatus: "done" }}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Move .* to .* week/ }),
    ).toBeNull();
    // Edit and comment stay; only the move is withheld.
    expect(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comments on Original text" }),
    ).toBeInTheDocument();
    done.unmount();

    render(
      <StatusOverviewItemPreview
        item={previousItem}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Move .* to .* week/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit details: Original text" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Comments on Original text" }),
    ).toBeNull();
  });

  it("opens the canonical item editor from the edit icon", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItem={onEditItem}
        onMoveItem={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    );
    expect(onEditItem).toHaveBeenLastCalledWith(item.editTarget);
  });

  it("gives the derived Next projection move and comment but no edit icon", () => {
    render(
      <StatusOverviewItemPreview
        item={projection}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Edit details: Original text" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Move Original text to current week",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comments on Original text" }),
    ).toBeInTheDocument();
  });

  it("focuses the record's comment flow from the comment icon", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, comments: [COMMENT] }}
        onMoveItem={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Comments on Original text" }),
    );
    await waitFor(() =>
      expect(
        document.getElementById("review-record:item:item-1"),
      ).toHaveFocus(),
    );
  });

  it("keeps the comment icon a no-op when the record has no comments", async () => {
    const user = userEvent.setup();
    render(<StatusOverviewItemPreview item={item} onMoveItem={vi.fn()} />);
    const icon = screen.getByRole("button", {
      name: "Comments on Original text",
    });

    await user.click(icon);
    expect(icon).toHaveFocus();
  });

  it("moves the focused Current card to Next with Alt+ArrowRight", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(<StatusOverviewItemPreview item={item} onMoveItem={onMoveItem} />);
    focusCard();

    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onMoveItem).toHaveBeenLastCalledWith(
      item,
      "next",
      "move:current:stable-1",
    );
  });

  it("moves the focused Next card to Current with Alt+ArrowLeft", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(
      <StatusOverviewItemPreview item={nextItem} onMoveItem={onMoveItem} />,
    );
    focusCard();

    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(onMoveItem).toHaveBeenLastCalledWith(
      nextItem,
      "current",
      "move:next:stable-1",
    );
  });

  it("does not move on a shortcut with no applicable direction", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(<StatusOverviewItemPreview item={item} onMoveItem={onMoveItem} />);
    focusCard();

    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(onMoveItem).not.toHaveBeenCalled();
    // The plain arrow without Alt is ordinary navigation, never a move.
    await user.keyboard("{ArrowRight}");
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("does not move a done item or a Previous item from the keyboard", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    const done = render(
      <StatusOverviewItemPreview
        item={{ ...item, workflowStatus: "done" }}
        onMoveItem={onMoveItem}
      />,
    );
    focusCard();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onMoveItem).not.toHaveBeenCalled();
    done.unmount();

    render(
      <StatusOverviewItemPreview item={previousItem} onMoveItem={onMoveItem} />,
    );
    focusCard();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("does not move while typing inside the inline editor", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItemText={vi.fn()}
        onMoveItem={onMoveItem}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Edit item: Original text" }),
    );
    const area = screen.getByRole("textbox", {
      name: "Edit item text: Original text",
    });
    expect(area).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onMoveItem).not.toHaveBeenCalled();
  });
});
