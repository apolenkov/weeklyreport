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
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};

const STATUS_BUTTON = "Choose outcome: Original text. Status: In progress";

describe("StatusOverviewItemPreview at rest", () => {
  it("names the status icon with the full update text, like Edit item", () => {
    const text = `A long update ${"that keeps going ".repeat(8)}to the end`;
    render(
      <StatusOverviewItemPreview
        item={{ ...item, text }}
        onEditItem={vi.fn()}
        onSetStatus={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `Choose outcome: ${text}. Status: In progress`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: `Edit text: ${text}, This week` }),
    ).toBeVisible();
  });

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
      screen.getByRole("button", {
        name: "Edit text: Original text, This week",
      }),
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
    expect(
      screen.getByRole("img", { name: "Stage: Development" }),
    ).toBeVisible();
  });

  it("names each stage icon", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, stageNames: ["Development", "Testing"] }}
      />,
    );

    for (const stage of ["Development", "Testing"])
      expect(
        screen.getByRole("img", { name: `Stage: ${stage}` }),
      ).toBeVisible();
  });

  it("keeps the unplanned meaning in the status name, not as a badge", () => {
    render(
      <StatusOverviewItemPreview item={{ ...item, continuity: "unplanned" }} />,
    );

    expect(screen.queryByText("Unplanned")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /· Unplanned$/ }),
    ).toBeInTheDocument();
  });

  it("wraps a long update and opens its full text", async () => {
    const user = userEvent.setup();
    const text = "Long update ".repeat(12).trim();
    render(<StatusOverviewItemPreview item={{ ...item, text }} />);
    expect(screen.getByText(text)).not.toHaveClass("line-clamp-2");
    await user.click(
      screen.getByRole("button", { name: `View text: ${text}, This week` }),
    );
    expect(screen.getByRole("dialog", { name: "Record" })).toHaveTextContent(
      text,
    );
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
      screen.getByRole("button", { name: /Edit text/ }),
    ).toHaveAccessibleName(`Edit text: ${text}, This week`);
  });

  it("renders no mutation controls and no status menu when no handlers are provided", () => {
    render(<StatusOverviewItemPreview item={{ ...item, canResolve: true }} />);

    expect(screen.getByText("Original text")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
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
      "Done",
      "In progress",
      "Not started",
      "Paused…",
      "Postponed",
      "Move to next week",
      "Won’t do…",
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

  it("opens a Next record without a status menu", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, source: "next", workflowStatus: "planned" }}
        onSetStatus={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /View text:/ }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("button", { name: /Choose outcome/ })).toBeNull();
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
      name: "Status not set",
    });
    expect(trigger).toHaveAttribute("id", "confirm:current:stable-1");
    expect(trigger).toHaveAttribute(
      "data-overview-focus",
      "confirm:current:stable-1",
    );
    expect(
      trigger.querySelector(".lucide-circle-question-mark"),
    ).not.toBeNull();
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
        name: "Status not set",
      }),
    ).toBeInTheDocument();
  });

  it("gives every status its own shape, not only a colour", () => {
    const shapes = (
      ["planned", "in_progress", "paused", "postponed", "done"] as const
    ).map((workflowStatus) => {
      const { container, unmount } = render(
        <StatusOverviewItemPreview
          item={{ ...item, workflowStatus, source: "current" }}
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

    expect(screen.queryByRole("img", { name: /Choose outcome/ })).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: "Edit text: Original text, Next week",
      }),
    );
    expect(onEditItem).toHaveBeenCalledWith(projection.editTarget);
  });
});

describe("StatusOverviewItemPreview revealed actions", () => {
  it("opens the editor from text and keeps secondary actions off the row", async () => {
    const user = userEvent.setup();
    const onMoveItem = vi.fn();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onEditItem={onEditItem}
        onMoveItem={onMoveItem}
        onResolvePlan={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: "Edit text: Original text, This week",
      }),
    );
    expect(onEditItem).toHaveBeenCalledWith(item.editTarget);

    expect(
      screen.queryByRole("button", { name: /^(Move|Discussion)/ }),
    ).toBeNull();
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("reaches the terminal outcome from the status menu, one level deep", async () => {
    const user = userEvent.setup();
    const onResolvePlan = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onSetStatus={vi.fn()}
        onResolvePlan={onResolvePlan}
      />,
    );

    await user.click(screen.getByRole("button", { name: STATUS_BUTTON }));
    await user.click(screen.getByRole("menuitem", { name: "Won’t do…" }));
    expect(onResolvePlan).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "resolve:current:stable-1",
    );
  });

  it("withholds the terminal outcome while a carried item is unconfirmed", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, needsConfirmation: true, canResolve: true }}
        onEditItem={vi.fn()}
        onSetStatus={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Status not set$/ }));
    expect(screen.getByRole("menuitem", { name: "Won’t do…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps a completed item editable but not movable and not clickable by text", () => {
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
    expect(
      screen.getByRole("button", {
        name: "Edit text: Original text, This week",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Move .* week$/ })).toBeNull();
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
      screen.getByRole("img", {
        name: "Choose outcome: Original text. Status: Won't do",
      }),
    ).toBeVisible();
    expect(screen.getByText("Won't do · Scope removed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestorePlan).toHaveBeenCalledWith(
      resolved,
      "restore:current:stable-1",
    );
  });

  it("keeps Last week read-only", async () => {
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

    expect(screen.getByText("Original text")).toBeVisible();
    expect(screen.getByRole("img", { name: STATUS_BUTTON })).toBeVisible();
    await user.click(screen.getByText("Original text"));
    expect(onPlanItem).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: /Status of|More actions|Edit/,
      }),
    ).toBeNull();
  });
});
