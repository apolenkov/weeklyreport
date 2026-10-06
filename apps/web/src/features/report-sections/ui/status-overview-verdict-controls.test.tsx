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

const NAMES = {
  done: "Done — Ship the importer",
  continue: "Continue — Ship the importer",
  next: "Next week — Ship the importer",
  paused: "Paused — Ship the importer",
} as const;

function setup(onVerdict = vi.fn().mockResolvedValue(null)) {
  const user = userEvent.setup();
  render(
    <StatusOverviewItemPreview
      item={pending}
      onVerdict={onVerdict}
      onPlanItem={vi.fn()}
    />,
  );
  return { user, onVerdict };
}

describe("verdict rail on a pending Previously planned item", () => {
  it("offers Done, Continue, Next week and Paused as named icon buttons", () => {
    setup();
    for (const name of Object.values(NAMES))
      expect(screen.getByRole("button", { name })).toBeVisible();
    // Won't do lives in the overflow menu, not on the rail.
    expect(
      screen.queryByRole("button", { name: /Won't do/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "More actions for Ship the importer",
      }),
    ).toBeVisible();
  });

  it("tells the verdicts apart by shape, not by colour", () => {
    setup();
    const shapes = Object.values(NAMES).map(
      (name) =>
        screen.getByRole("button", { name }).querySelector("svg")?.innerHTML,
    );
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("offers no replan icon next to the pending rail", () => {
    setup();
    expect(screen.queryByRole("button", { name: /Plan this work/ })).toBeNull();
  });

  it("keeps every button and overflow menu item at the minimum touch target", async () => {
    const { user } = setup();
    for (const button of screen.getAllByRole("button"))
      expect(button.className).toContain("var(--touch-target-min)");
    await user.click(
      screen.getByRole("button", {
        name: "More actions for Ship the importer",
      }),
    );
    const items = await screen.findAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
    for (const menuItem of items)
      expect(menuItem.className).toContain("var(--touch-target-min)");
  });

  it.each(["done", "continue", "next"] as const)(
    "records %s in one activation without a reason",
    async (verdict) => {
      const { user, onVerdict } = setup();
      await user.click(screen.getByRole("button", { name: NAMES[verdict] }));
      expect(onVerdict).toHaveBeenCalledExactlyOnceWith(
        pending,
        verdict,
        undefined,
      );
    },
  );

  it("reaches and activates the rail from the keyboard", async () => {
    const { user, onVerdict } = setup();
    await user.tab();
    expect(screen.getByRole("button", { name: NAMES.done })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: NAMES.continue })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onVerdict).toHaveBeenCalledWith(pending, "continue", undefined);
  });

  it("shows a failed write and keeps the rail so it can be retried", async () => {
    const { user } = setup(vi.fn().mockResolvedValue("Wait for autosave."));
    await user.click(screen.getByRole("button", { name: NAMES.done }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wait for autosave.",
    );
    expect(screen.getByRole("button", { name: NAMES.done })).toBeEnabled();
  });
});

describe("verdicts that need a reason", () => {
  it("asks for a pause reason inline and saves it with Enter", async () => {
    const { user, onVerdict } = setup();
    await user.click(screen.getByRole("button", { name: NAMES.paused }));
    const input = screen.getByRole("textbox", {
      name: "Paused reason — Ship the importer",
    });
    expect(input).toHaveFocus();
    expect(onVerdict).not.toHaveBeenCalled();
    await user.type(input, "  Waiting on vendor {Enter}");
    expect(onVerdict).toHaveBeenCalledExactlyOnceWith(
      pending,
      "paused",
      "  Waiting on vendor ",
    );
  });

  it("saves the reason with the Save button too", async () => {
    const { user, onVerdict } = setup();
    await user.click(screen.getByRole("button", { name: NAMES.paused }));
    await user.type(screen.getByRole("textbox"), "Blocked");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onVerdict).toHaveBeenCalledWith(pending, "paused", "Blocked");
  });

  it("does not accept an empty or blank pause reason", async () => {
    const { user, onVerdict } = setup();
    await user.click(screen.getByRole("button", { name: NAMES.paused }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.type(screen.getByRole("textbox"), "   {Enter}");
    expect(onVerdict).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add a one-line reason",
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("cancels with Escape and returns focus to the control that opened it", async () => {
    const { user, onVerdict } = setup();
    await user.click(screen.getByRole("button", { name: NAMES.paused }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: NAMES.paused })).toHaveFocus(),
    );
    expect(onVerdict).not.toHaveBeenCalled();
  });

  it("records Won't do from the overflow menu with a reason", async () => {
    const { user, onVerdict } = setup();
    await user.click(
      screen.getByRole("button", {
        name: "More actions for Ship the importer",
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Won't do — Ship the importer",
      }),
    );
    const input = await screen.findByRole("textbox", {
      name: "Won't do reason — Ship the importer",
    });
    await user.type(input, "Out of scope{Enter}");
    expect(onVerdict).toHaveBeenCalledExactlyOnceWith(
      pending,
      "wont_do",
      "Out of scope",
    );
  });

  it("does not accept Won't do without a reason", async () => {
    const { user, onVerdict } = setup();
    await user.click(
      screen.getByRole("button", {
        name: "More actions for Ship the importer",
      }),
    );
    await user.click(await screen.findByRole("menuitem"));
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(onVerdict).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeVisible();
  });
});

describe("accepted verdict stamp on the frozen Previous row", () => {
  it.each([
    ["done", "Verdict: Done"],
    ["continue", "Verdict: Continue"],
    ["next", "Verdict: Next week"],
    ["paused", "Verdict: Paused"],
    ["wont_do", "Verdict: Won't do"],
  ] as const)("stamps %s and removes the rail", (verdict, name) => {
    render(
      <StatusOverviewItemPreview
        item={{ ...pending, verdict }}
        onVerdict={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name })).toBeVisible();
    expect(screen.getByText("Ship the importer")).toBeVisible();
    expect(screen.queryByRole("button", { name: NAMES.done })).toBeNull();
  });

  it("shows no rail when verdicts cannot be written", () => {
    render(<StatusOverviewItemPreview item={pending} />);
    expect(screen.queryByRole("button", { name: NAMES.done })).toBeNull();
  });

  it("never offers verdicts on a Current item", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...pending, source: "current", verdict: "pending" }}
        onVerdict={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: NAMES.done })).toBeNull();
  });
});
