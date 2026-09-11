import { render, screen } from "@testing-library/react";
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
    ).toBeInTheDocument();
  });

  it("exposes Edit and Resolve plan actions in the row action cluster", () => {
    const onResolvePlan = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onQuickEditText={vi.fn()}
        onResolvePlan={onResolvePlan}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Edit Original text" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve plan: Original text" }),
    ).toBeInTheDocument();
  });
});
