// @vitest-environment jsdom
// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  COMMENT,
  focusCard,
  item,
  nextItem,
  previousItem,
  projection,
} from "./status-overview-item-icons.test-support";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";
describe("StatusOverviewItemPreview hover action icons — 1", () => {
  it("shows the week-move icon toward the other active week", () => {
    const current = render(
      <StatusOverviewItemPreview item={item} onMoveItem={vi.fn()} />,
    );
    const moveIcon = screen.getByRole("button", {
      name: "Move Original text to next week",
    });
    // Compact in the floating chip on pointers; full touch target on touch.
    expect(moveIcon).toHaveClass("h-7");
    expect(moveIcon).toHaveClass(
      "[@media(hover:none)]:min-h-[var(--touch-target-min)]",
    );
    current.unmount();

    render(<StatusOverviewItemPreview item={nextItem} onMoveItem={vi.fn()} />);
    expect(
      screen.getByRole("button", {
        name: "Move Original text to current week",
      }),
    ).toBeInTheDocument();
  });
});
describe("StatusOverviewItemPreview hover action icons — 2", () => {
  it("moves from the icon, the only week-move entry", async () => {
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
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
  });
});
describe("StatusOverviewItemPreview hover action icons — 3", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 4", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 5", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 6", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 7", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 8", () => {
  it("focuses the record card from the comment icon while no comments exist", async () => {
    const user = userEvent.setup();
    render(<StatusOverviewItemPreview item={item} onMoveItem={vi.fn()} />);
    const icon = screen.getByRole("button", {
      name: "Comments on Original text",
    });

    await user.click(icon);
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>("[data-overview-item-preview]"),
      ).toHaveFocus(),
    );
  });
});
describe("StatusOverviewItemPreview hover action icons — 9", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 10", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 11", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 12", () => {
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
});
describe("StatusOverviewItemPreview hover action icons — 13", () => {
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
