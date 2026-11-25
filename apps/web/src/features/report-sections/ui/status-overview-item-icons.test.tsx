// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { setupPanel } from "./overview-record-panel.test-support";
import {
  focusCard,
  item,
  nextItem,
  previousItem,
} from "./status-overview-item-icons.test-support";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";
it.each([item, nextItem])(
  "moves $source work from the panel action",
  async (record) => {
    const { move } = setupPanel(false, { record });
    const target = record.source === "next" ? "this" : "next";
    await userEvent.click(
      screen.getByRole("button", { name: `Move to ${target} week` }),
    );
    expect(move).toHaveBeenCalledOnce();
  },
);
it("explains why a derived next step cannot move", () => {
  setupPanel(true);
  expect(
    screen.getByRole("button", { name: /^Move/ }),
  ).toHaveAccessibleDescription("A next step stays with its item.");
});
describe("Record keyboard shortcuts — 9", () => {
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
describe("Record keyboard shortcuts — 10", () => {
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
describe("Record keyboard shortcuts — 11", () => {
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
describe("Record keyboard shortcuts — 12", () => {
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
describe("Record keyboard shortcuts — 13", () => {
  it("does not move while typing inside the inline editor", async () => {
    const user = userEvent.setup();
    const { move: onMoveItem } = setupPanel();
    const area = screen.getByRole("textbox", { name: "Record text" });
    expect(area).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onMoveItem).not.toHaveBeenCalled();
  });
});
