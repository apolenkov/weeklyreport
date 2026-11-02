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

describe("overview stage control", () => {
  it("saves one toggle and prevents removing the last stage", async () => {
    const user = userEvent.setup();
    const onSetStages = vi.fn().mockResolvedValue(null);
    render(
      <StatusOverviewItemPreview
        item={item}
        ownedStages={stages}
        onSetStages={onSetStages}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Stages for Work" }));
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Development" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("A Product item keeps at least one stage"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Testing" }));
    expect(onSetStages).toHaveBeenCalledWith(
      item,
      ["Development", "Testing"],
      "stage:current:stable",
    );
    expect(
      screen.getByRole("button", { name: "Stages for Work" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Testing" }),
    ).toBeInTheDocument();
  });

  it("hides when the unit owns a single stage", () => {
    render(
      <StatusOverviewItemPreview
        item={item}
        ownedStages={["Development"]}
        onSetStages={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Stages for Work" }),
    ).not.toBeInTheDocument();
  });

  it("hides without a product stage list or save handler", () => {
    const { rerender } = render(
      <StatusOverviewItemPreview item={item} onSetStages={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Stages for Work" }),
    ).not.toBeInTheDocument();
    rerender(<StatusOverviewItemPreview item={item} ownedStages={stages} />);
    expect(
      screen.queryByRole("button", { name: "Stages for Work" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    { ...item, source: "previous" as const },
    { ...item, editTarget: null },
    {
      ...item,
      editTarget: {
        recordId: "one",
        source: "current" as const,
        focusNextStep: true,
      },
    },
    { ...item, needsConfirmation: true },
  ])("hides for ineligible items", (value) => {
    render(
      <StatusOverviewItemPreview
        item={value}
        ownedStages={stages}
        onSetStages={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Stages for Work" }),
    ).not.toBeInTheDocument();
  });
});
