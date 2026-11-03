import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

const item: StatusOverviewItem = {
  key: "one",
  recordId: "one",
  stableId: "stable",
  source: "current",
  editTarget: { recordId: "one", source: "current" },
  text: "Work",
  tag: "feature",
  stageNames: ["Development"],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: null,
};
const stages = ["Development", "Testing"];

describe("direct stage labels", () => {
  it("shows labels directly and toggles with keyboard while keeping the last stage", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(null);
    const { rerender } = render(
      <StatusOverviewItemPreview
        item={item}
        ownedStages={stages}
        onSetStages={save}
      />,
    );
    expect(screen.getByRole("button", { name: "Development" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Development" })).toBeDisabled();
    const testing = screen.getByRole("button", { name: "Testing" });
    testing.focus();
    await user.keyboard("{Enter}");
    expect(save).toHaveBeenCalledWith(item, stages, "stage:current:stable");
    expect(testing).toHaveFocus();
    const updated = { ...item, stageNames: stages };
    rerender(
      <StatusOverviewItemPreview
        item={updated}
        ownedStages={stages}
        onSetStages={save}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Development" }));
    expect(save).toHaveBeenLastCalledWith(
      updated,
      ["Testing"],
      "stage:current:stable",
    );
  });
  it("updates explicit Next items", async () => {
    const user = userEvent.setup();
    const next = {
      ...item,
      source: "next" as const,
      editTarget: { recordId: "one", source: "next" as const },
    };
    const save = vi.fn().mockResolvedValue(null);
    render(
      <StatusOverviewItemPreview
        item={next}
        ownedStages={stages}
        onSetStages={save}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Testing" }));
    expect(save).toHaveBeenCalledWith(next, stages, "stage:next:stable");
  });
  it("preserves the text draft when a stage is selected", async () => {
    const user = userEvent.setup();
    const saveText = vi.fn();
    const saveStages = vi.fn().mockResolvedValue(null);
    render(
      <StatusOverviewItemPreview
        item={item}
        ownedStages={stages}
        onSetStages={saveStages}
        onEditItemText={saveText}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edit item: Work" }));
    const editor = screen.getByRole("textbox", {
      name: "Edit item text: Work",
    });
    await user.clear(editor);
    await user.type(editor, "Draft work");
    await user.click(screen.getByRole("button", { name: "Testing" }));
    expect(saveText).toHaveBeenCalledWith(item, "Draft work");
    expect(saveStages).toHaveBeenCalledWith(
      item,
      stages,
      "stage:current:stable",
    );
  });
  it.each([[[]], [["Foreign"]], [["Development", "Foreign"]]])(
    "blocks stale or foreign selected stages %j",
    async (selected) => {
      const user = userEvent.setup();
      const save = vi.fn();
      render(
        <StatusOverviewItemPreview
          item={{ ...item, stageNames: selected }}
          ownedStages={stages}
          onSetStages={save}
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(/out of date/i);
      expect(screen.getByRole("button", { name: "Testing" })).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Testing" }));
      expect(save).not.toHaveBeenCalled();
    },
  );
  it("shows the sole stage selected and unavailable for removal", () => {
    render(
      <StatusOverviewItemPreview
        item={item}
        ownedStages={["Development"]}
        onSetStages={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Development" })).toBeDisabled();
    expect(screen.getByText(/keeps at least one stage/i)).toBeInTheDocument();
  });
  it.each([
    { ...item, source: "previous" as const },
    { ...item, editTarget: null },
    { ...item, needsConfirmation: true },
    {
      ...item,
      editTarget: {
        recordId: "one",
        source: "current" as const,
        focusNextStep: true,
      },
    },
  ])("does not offer editing to ineligible items", (value) => {
    render(
      <StatusOverviewItemPreview
        item={value}
        ownedStages={stages}
        onSetStages={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Testing" }),
    ).not.toBeInTheDocument();
  });
  it("blocks pending updates and exposes a failure for retry", async () => {
    const user = userEvent.setup();
    let reject!: (reason: Error) => void;
    const save = vi.fn().mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(
      <StatusOverviewItemPreview
        item={item}
        ownedStages={stages}
        onSetStages={save}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Testing" }));
    expect(screen.getByRole("button", { name: "Testing" })).toBeDisabled();
    reject(new Error("failed"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByRole("button", { name: "Testing" })).toBeEnabled();
  });
});
