import { render, screen, within } from "@testing-library/react";
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
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};

const STATUS_BUTTON = "Status of Original text: In progress";

describe("StatusOverviewItemPreview at rest", () => {
  it("shows the status icon, the text and a short stage badge only", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, pausedReason: "Waiting", canResolve: true }}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
        onResolvePlan={vi.fn()}
        onSetStatus={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: STATUS_BUTTON })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit item: Original text" }),
    ).toBeVisible();
    // No permanent text button and no metadata line.
    for (const label of [
      "Update progress",
      "More actions",
      "Edit item",
      "Edit details",
      "Plan this work",
    ]) {
      expect(screen.queryByText(label, { exact: true })).toBeNull();
    }
    expect(screen.queryByText(/In progress/)).toBeNull();
    expect(screen.queryByText(/Paused:/)).toBeNull();
    expect(screen.queryByText("feature")).toBeNull();
    // The badge is short; the full stage names live in the name and tooltip.
    expect(screen.queryByText("Development")).toBeNull();
    const badge = screen.getByRole("img", { name: "Stages: Development" });
    expect(badge).toHaveTextContent("Dev");
    expect(badge).toHaveAttribute("title", "Development");
  });

  it("summarises several stages with a count and names them all", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, stageNames: ["Development", "Testing"] }}
      />,
    );

    const badge = screen.getByRole("img", {
      name: "Stages: Development, Testing",
    });
    expect(badge).toHaveTextContent("Dev +1");
    expect(badge).toHaveAttribute("title", "Development, Testing");
  });

  it("marks an unplanned item with a small badge", () => {
    render(
      <StatusOverviewItemPreview item={{ ...item, continuity: "unplanned" }} />,
    );

    expect(screen.getByText("Unplanned")).toBeInTheDocument();
  });

  it("clamps a long collapsed update to two lines until it is expanded", async () => {
    const user = userEvent.setup();
    const text = "Long update ".repeat(12).trim();
    render(<StatusOverviewItemPreview item={{ ...item, text }} />);
    const preview = screen.getByText(text);
    expect(preview).toHaveClass("line-clamp-2");
    expect(preview).not.toHaveClass("block");

    await user.click(screen.getByRole("button", { name: /Show full update/ }));
    expect(preview).toHaveClass("block");
    expect(preview).not.toHaveClass("line-clamp-2");
  });

  it("keeps the full visible text inside the accessible name of the title button", () => {
    const text = "Long update ".repeat(12).trim();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, text }}
        onEditItem={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Edit item/ }),
    ).toHaveAccessibleName(`Edit item: ${text}`);
  });

  it("renders no mutation controls and no status menu when no handlers are provided", () => {
    render(<StatusOverviewItemPreview item={{ ...item, canResolve: true }} />);

    expect(screen.getByText("Original text").tagName).toBe("P");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("img", { name: STATUS_BUTTON })).toBeVisible();
  });
});

describe("StatusOverviewItemPreview status menu", () => {
  it("opens a menu of statuses on the icon instead of cycling", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItem={onEditItem}
        onSetStatus={onSetStatus}
      />,
    );

    const trigger = screen.getByRole("button", { name: STATUS_BUTTON });
    expect(trigger).toHaveAttribute(
      "data-overview-focus",
      "edit:current:stable-1",
    );
    await user.click(trigger);
    const labels = screen
      .getAllByRole("menuitem")
      .map((entry) => entry.textContent);
    expect(labels).toEqual([
      "Not started",
      "In progress",
      "Paused",
      "Postponed",
      "Done",
    ]);
    expect(
      screen.getByRole("menuitem", { name: "In progress" }),
    ).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("menuitem", { name: "Done" }));
    expect(onSetStatus).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "done",
      "edit:current:stable-1",
    );
    expect(onEditItem).not.toHaveBeenCalled();
  });

  it("names Next-week statuses as planned rather than not started", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, source: "next", workflowStatus: "planned" }}
        onSetStatus={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Status of Original text: Planned" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Planned" }),
    ).toBeInTheDocument();
  });

  it("opens from the keyboard and returns focus to the icon", async () => {
    const user = userEvent.setup();
    render(<StatusOverviewItemPreview item={item} onSetStatus={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: STATUS_BUTTON });
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("marks an unconfirmed carried item on the icon and anchors the readiness link", async () => {
    const user = userEvent.setup();
    const onConfirmItem = vi.fn();
    const onSetStatus = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{
          ...item,
          needsConfirmation: true,
          workflowStatus: "planned",
        }}
        onConfirmItem={onConfirmItem}
        onSetStatus={onSetStatus}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Status of Original text: Planned · not updated this week",
    });
    expect(trigger).toHaveAttribute("id", "confirm:current:stable-1");
    expect(trigger).toHaveAttribute(
      "data-overview-focus",
      "confirm:current:stable-1",
    );
    expect(trigger.querySelector('circle[r="3.5"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();

    // Keeping the shown status is the confirmation; no separate button.
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Not started" }));
    expect(onConfirmItem).toHaveBeenCalledTimes(1);
    expect(onSetStatus).not.toHaveBeenCalled();

    // Any other status goes through the status write, which clears the marker.
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "In progress" }));
    expect(onSetStatus).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "in_progress",
      "confirm:current:stable-1",
    );
  });

  it("labels a carried in-progress item as continued but not updated", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, needsConfirmation: true }}
        onSetStatus={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Status of Original text: Continued · not updated this week",
      }),
    ).toBeInTheDocument();
  });

  it("gives every status its own shape, not only a colour", () => {
    const shapes = (
      ["planned", "in_progress", "paused", "postponed", "done"] as const
    ).map((workflowStatus) => {
      const { container, unmount } = render(
        <StatusOverviewItemPreview
          item={{ ...item, workflowStatus, source: "next" }}
        />,
      );
      const markup = container.querySelector("svg")?.innerHTML ?? "";
      unmount();
      return markup;
    });
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("keeps the linked Next projection a plain image; its text still edits", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    const projection = {
      ...item,
      source: "next" as const,
      workflowStatus: "planned" as const,
      editTarget: {
        recordId: "item-1",
        source: "current" as const,
        focusNextStep: true,
      },
    };
    render(
      <StatusOverviewItemPreview
        item={projection}
        onEditItem={onEditItem}
        onSetStatus={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Status of Original text: Planned" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Edit item: Original text" }),
    );
    expect(onEditItem).toHaveBeenCalledWith(projection.editTarget);
  });
});

describe("StatusOverviewItemPreview revealed actions", () => {
  it("keeps secondary actions in one More actions menu", async () => {
    const user = userEvent.setup();
    const onResolvePlan = vi.fn();
    const onMoveItem = vi.fn();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={onEditItem}
        onMoveItem={onMoveItem}
        onResolvePlan={onResolvePlan}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Edit details: Original text" }),
    );
    expect(onEditItem).toHaveBeenCalledWith(item.editTarget);

    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Update status: Original text" }),
    );
    expect(onResolvePlan).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "resolve:current:stable-1",
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: "Move to next week: Original text",
      }),
    );
    expect(onMoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Original text" }),
      "next",
      "move:current:stable-1",
    );
  });

  it("offers a quick week move as an icon beside the overflow", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItem={vi.fn()}
        onMoveItem={onMoveItem}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Quick move to next week: Original text",
      }),
    );
    expect(onMoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "next",
      "move:current:stable-1",
    );
  });

  it("withholds Update status while a carried item is unconfirmed", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, needsConfirmation: true, canResolve: true }}
        onEditItem={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: /Update status/ }),
    ).toBeNull();
  });

  it("keeps a completed item editable but not movable and not clickable by text", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, workflowStatus: "done" }}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
        onResolvePlan={vi.fn()}
        onSetStatus={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Edit item/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Quick move/ })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "More actions for Original text" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Edit details: Original text" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Move to .* week/ }),
    ).toBeNull();
  });

  it("keeps a resolved item restorable with its reason and no competing controls", async () => {
    const user = userEvent.setup();
    const resolved = {
      ...item,
      editTarget: null,
      canResolve: false,
      canRestore: true,
      resolution: {
        kind: "wont_do" as const,
        eventId: "50000000-0000-4000-8000-000000000030",
        reason: "Scope removed",
        actorId: "50000000-0000-4000-8000-000000000031",
        actorName: "Test Lead",
        occurredAt: "2026-09-05T12:00:00.000Z",
        previousState: {
          type: "current" as const,
          workflowStatus: "in_progress" as const,
          pausedReason: null,
          nextStepText: null,
          text: "Original text",
        },
      },
    };
    const onRestorePlan = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={resolved}
        onResolvePlan={vi.fn()}
        onSetStatus={vi.fn()}
        onRestorePlan={onRestorePlan}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Status of Original text: Won't do" }),
    ).toBeVisible();
    expect(screen.getByText("Won't do · Scope removed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Restore Original text" }),
    );
    expect(onRestorePlan).toHaveBeenCalledWith(
      resolved,
      "restore:current:stable-1",
    );
  });

  it("keeps Previous read-only with only the explicit replan action", async () => {
    const user = userEvent.setup();
    const previous = {
      ...item,
      source: "previous" as const,
      editTarget: null,
      canResolve: true,
    };
    const onPlanItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={previous}
        onPlanItem={onPlanItem}
        onResolvePlan={vi.fn()}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
        onConfirmItem={vi.fn()}
        onSetStatus={vi.fn()}
      />,
    );

    expect(screen.getByText("Original text").tagName).toBe("P");
    expect(screen.getByRole("img", { name: STATUS_BUTTON })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Plan this work/ }));
    expect(onPlanItem).toHaveBeenCalledWith(previous);
    expect(
      screen.queryByRole("button", {
        name: /Status of|More actions|Quick move|Edit/,
      }),
    ).toBeNull();
  });
});

describe("StatusOverviewItemPreview reveal and keyboard", () => {
  const handlers = {
    onEditItem: vi.fn(),
    onMoveItem: vi.fn(),
    onResolvePlan: vi.fn(),
    onSetStatus: vi.fn(),
  };

  it("hides the action zone with opacity and width only, never from the tree", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    const zone = document.querySelector("[data-overview-item-actions]");
    expect(zone).not.toBeNull();
    const classes = zone?.className ?? "";
    expect(classes).toContain("opacity-0");
    // Revealed on hover, focus within, an open menu, and where hover cannot exist.
    expect(classes).toContain("group-hover/item:opacity-100");
    expect(classes).toContain("group-focus-within/item:opacity-100");
    expect(classes).toContain("has-[[data-state=open]]:opacity-100");
    expect(classes).toContain("[@media(hover:none)]:opacity-100");
    for (const hiding of ["hidden", "invisible", "sr-only"]) {
      expect(zone).not.toHaveClass(hiding);
    }
    // Still reachable by name while visually hidden.
    const more = within(zone as HTMLElement).getByRole("button", {
      name: "More actions for Original text",
    });
    expect(more).toHaveClass("min-h-[var(--touch-target-min)]");
    expect(more).toHaveClass("min-w-[var(--touch-target-min)]");
  });

  it("gives every control the touch target size", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("min-h-[var(--touch-target-min)]");
    }
  });

  it("tabs from the status icon through the text to the revealed actions", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: STATUS_BUTTON })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit item: Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: /^Quick move to next week/ }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "More actions for Original text" }),
    ).toHaveFocus();
  });

  it("opens the overflow on a touch tap", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        {...handlers}
      />,
    );

    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", {
        name: "More actions for Original text",
      }),
    });
    expect(
      screen.getByRole("menuitem", { name: "Edit details: Original text" }),
    ).toBeInTheDocument();
  });
});
