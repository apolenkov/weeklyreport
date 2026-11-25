import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

const pending: StatusOverviewItem = {
  key: "previous:stable-1",
  recordId: "prior-1",
  source: "previous",
  editTarget: null,
  stableId: "stable-1",
  text: "Ship the importer",
  tag: "delivery",
  stageNames: [],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: true,
  canRestore: false,
  workflowStatus: "planned",
  continuity: null,
  verdict: "pending",
};

const outcomeName =
  "Choose outcome: Ship the importer. Planned last week, no outcome yet";
function setup(onVerdict = vi.fn().mockResolvedValue(null)) {
  const user = userEvent.setup();
  render(<StatusOverviewItemPreview item={pending} onVerdict={onVerdict} />);
  const trigger = screen.getByRole("button", { name: outcomeName });
  async function choose(name: string) {
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name }));
  }
  return { user, onVerdict, trigger, choose };
}

describe("the frozen plan's outcome menu", () => {
  it("exposes a single outcome control with five labelled, distinct icons", async () => {
    const { user, trigger, onVerdict } = setup();
    expect(screen.getAllByRole("button")).toEqual([trigger]);
    expect(trigger).toHaveAttribute(
      "title",
      "Planned last week — choose what happened",
    );
    expect(screen.queryByText("What happened to this plan?")).toBeNull();
    await user.click(trigger);
    const options = screen.getAllByRole("menuitem");
    expect(options.map((option) => option.textContent)).toEqual([
      "Done",
      "In progress",
      "Next week",
      "Paused…",
      "Won’t do…",
    ]);
    expect(
      new Set(options.map((option) => option.querySelector("svg")?.innerHTML))
        .size,
    ).toBe(5);
    for (const option of options)
      expect(option.className).toContain("var(--touch-target-min)");
    expect(onVerdict).not.toHaveBeenCalled();
  });
  it.each([
    ["Done", "done"],
    ["In progress", "continue"],
    ["Next week", "next"],
  ])("records %s in one activation", async (label, verdict) => {
    const { choose, onVerdict } = setup();
    await choose(label);
    expect(onVerdict).toHaveBeenCalledExactlyOnceWith(
      pending,
      verdict,
      undefined,
    );
  });
  it("reaches the second outcome using the keyboard", async () => {
    const { trigger, user, onVerdict } = setup();
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(onVerdict).toHaveBeenCalledWith(pending, "continue", undefined);
  });
  it.each([
    ["Paused…", "paused"],
    ["Won’t do…", "wont_do"],
  ])(
    "requires a visible one-line reason for %s and retains it after failure",
    async (label, verdict) => {
      const { user, choose, onVerdict } = setup(
        vi.fn().mockResolvedValue("Save failed."),
      );
      await choose(label);
      const field = screen.getByRole("textbox");
      await waitFor(() => expect(field).toHaveFocus());
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onVerdict).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "One line is enough, but it can’t be empty.",
      );
      await user.type(field, "Dependency unavailable{Enter}");
      expect(await screen.findByText("Save failed.")).toBeVisible();
      expect(field).toHaveValue("Dependency unavailable");
      expect(onVerdict).toHaveBeenCalledWith(
        pending,
        verdict,
        "Dependency unavailable",
      );
    },
  );
  it("returns focus after cancelling an empty reason", async () => {
    const { user, choose } = setup();
    await choose("Paused…");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: outcomeName })).toHaveFocus(),
    );
  });
  it("retains a typed reason after Escape", async () => {
    const { user, choose, onVerdict } = setup();
    await choose("Won’t do…");
    const field = screen.getByRole("textbox");
    await user.type(field, "Keep this reason{Escape}");
    expect(field).toHaveValue("Keep this reason");
    expect(onVerdict).not.toHaveBeenCalled();
  });
  it("keeps the menu operable after an unsuccessful answer", async () => {
    const { choose, trigger } = setup(
      vi.fn().mockResolvedValue("Wait for autosave."),
    );
    await choose("Done");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wait for autosave.",
    );
    expect(trigger).toBeEnabled();
  });
  it("shows the unanswered submitted plan without an answer control", () => {
    render(<StatusOverviewItemPreview item={pending} />);
    expect(screen.getByRole("img", { name: "No outcome" })).toBeVisible();
    expect(screen.getByText("Not answered")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
