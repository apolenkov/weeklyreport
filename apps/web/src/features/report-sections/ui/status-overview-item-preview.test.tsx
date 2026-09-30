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

describe("StatusOverviewItemPreview", () => {
  it("keeps historical text read-only even when row handlers are available", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, source: "previous", editTarget: null }}
        onEditItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Original text")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit item|Update progress/ }),
    ).toBeNull();
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

  it("keeps the full visible text inside the accessible name of the title buttons", () => {
    const text = "Long update ".repeat(12).trim();
    const longItem = { ...item, text };
    render(<StatusOverviewItemPreview item={longItem} onEditItem={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Edit item/ }),
    ).toHaveAccessibleName(`Edit item: ${text}`);
  });

  it("opens the same canonical target from the active title and the Edit details action", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(<StatusOverviewItemPreview item={item} onEditItem={onEditItem} />);

    const title = screen.getByRole("button", {
      name: "Edit item: Original text",
    });
    expect(title).toHaveClass("min-h-[var(--touch-target-min)]");
    await user.click(title);
    await user.click(screen.getByText("More actions"));
    await user.click(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    );

    expect(onEditItem).toHaveBeenCalledTimes(2);
    expect(onEditItem.mock.calls[0]?.[0]).toBe(item.editTarget);
    expect(onEditItem.mock.calls[1]?.[0]).toBe(item.editTarget);
  });

  it("exposes one Update progress primary and keeps Edit and move inside More actions", async () => {
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

    const primary = screen.getByRole("button", {
      name: "Update progress for Original text",
    });
    // No competing primaries or arrow-glyph week controls remain; the terminal
    // outcome path lives only inside the quiet overflow.
    expect(
      screen.queryByRole("button", { name: /Confirm for this week/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Plan this work/ }),
    ).toBeNull();
    expect(screen.queryByText(/[→←]/)).toBeNull();

    await user.click(primary);
    // The single primary opens the canonical editor; it never resolves or
    // confirms directly.
    expect(onEditItem).toHaveBeenCalledWith(item.editTarget);
    expect(onResolvePlan).not.toHaveBeenCalled();

    await user.click(screen.getByText("More actions"));
    await user.click(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    );
    expect(onEditItem).toHaveBeenCalledWith(item.editTarget);
    const updateStatus = screen.getByRole("button", {
      name: "Update status: Original text",
    });
    // The outcome entry is confined to the disclosure — never a standalone
    // control beside the primary.
    expect(updateStatus.closest("details")).toContainElement(
      screen.getByText("More actions"),
    );
    await user.click(updateStatus);
    expect(onResolvePlan).toHaveBeenCalledWith(
      expect.objectContaining({ key: "item-1" }),
      "resolve:current:stable-1",
    );
    await user.click(
      screen.getByRole("button", { name: "Move to next week: Original text" }),
    );
    expect(onMoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Original text" }),
      "next",
      "move:current:stable-1",
    );
  });

  it("uses the same Update progress interaction on an unconfirmed carried item", async () => {
    const user = userEvent.setup();
    const carried = {
      ...item,
      needsConfirmation: true,
      workflowStatus: "planned" as const,
    };
    const onConfirmItem = vi.fn();
    const onResolvePlan = vi.fn();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={carried}
        onConfirmItem={onConfirmItem}
        onResolvePlan={onResolvePlan}
        onEditItem={onEditItem}
      />,
    );

    expect(
      screen.getByText("Planned · not updated this week"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm for this week/ }),
    ).toBeNull();
    const primary = screen.getByRole("button", {
      name: "Update progress for Original text",
    });
    // The submit-readiness deep link still resolves to this control.
    expect(primary).toHaveAttribute("id", "confirm:current:stable-1");
    expect(primary).toHaveAttribute(
      "data-overview-focus",
      "confirm:current:stable-1",
    );
    await user.click(primary);
    // Carried work goes through the same canonical editor; the save path — not
    // this click — is what clears carriedOver.
    expect(onEditItem).toHaveBeenCalledWith(carried.editTarget);
    expect(onConfirmItem).not.toHaveBeenCalled();
    expect(onResolvePlan).not.toHaveBeenCalled();

    // The terminal outcome entry stays withheld while the carry is
    // unconfirmed; Update progress is the only path to clear it.
    await user.click(screen.getByText("More actions"));
    expect(
      screen.queryByRole("button", { name: "Update status: Original text" }),
    ).toBeNull();
  });

  it("withholds Update progress from a carried item with no edit target", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, editTarget: null, needsConfirmation: true }}
        onConfirmItem={vi.fn()}
        onResolvePlan={vi.fn()}
        onEditItem={vi.fn()}
      />,
    );

    // No canonical editor can open without an edit target, so the single
    // primary is withheld rather than falling back to a direct confirm.
    expect(
      screen.queryByRole("button", { name: /Update progress/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Confirm for this week/ }),
    ).toBeNull();
  });

  it("labels a carried in-progress item as continued but not updated", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, needsConfirmation: true }}
        onConfirmItem={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Continued · not updated this week"),
    ).toBeInTheDocument();
  });

  it("withholds Update progress from a completed item but keeps Edit details", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, workflowStatus: "done" }}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Update progress/ }),
    ).toBeNull();
    await user.click(screen.getByText("More actions"));
    expect(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Move to .* week: Original text/ }),
    ).toBeNull();
  });

  it("keeps a resolved item restorable without competing primaries", async () => {
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
        onRestorePlan={onRestorePlan}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Update progress/ }),
    ).toBeNull();
    expect(screen.queryByText("More actions")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Restore Original text" }),
    );
    expect(onRestorePlan).toHaveBeenCalledWith(
      resolved,
      "restore:current:stable-1",
    );
  });

  it("renders no mutation controls when no handlers are provided", () => {
    render(<StatusOverviewItemPreview item={{ ...item, canResolve: true }} />);

    expect(screen.getByText("Original text").tagName).toBe("P");
    expect(
      screen.queryByRole("button", { name: /Update progress/ }),
    ).toBeNull();
    expect(screen.queryByText("More actions")).toBeNull();
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
    const onResolvePlan = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={previous}
        onPlanItem={onPlanItem}
        onResolvePlan={onResolvePlan}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
        onConfirmItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Original text").tagName).toBe("P");
    await user.click(screen.getByRole("button", { name: /^Plan this work/ }));
    expect(onPlanItem).toHaveBeenCalledWith(previous);
    expect(
      screen.queryByRole("button", {
        name: /Update progress|Update status|Confirm/,
      }),
    ).toBeNull();
    expect(screen.queryByText("More actions")).toBeNull();
  });

  it("keeps the row actions off the update text so nothing is covered", () => {
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    const text = screen.getByRole("button", {
      name: "Edit item: Original text",
    });
    const cluster = document.querySelector("[data-overview-item-actions]");
    expect(cluster).not.toBeNull();
    // The actions share the metadata line instead of overlaying the text.
    expect(cluster).not.toHaveClass("absolute");
    expect(text.contains(cluster)).toBe(false);
    expect(cluster?.previousElementSibling?.textContent).toContain(
      "In progress",
    );
    // Hidden until hover or focus, and always visible where hover cannot exist.
    expect(cluster).not.toHaveClass("opacity-0");
    expect(cluster?.className).not.toContain("group-hover/item:opacity-100");
    expect(cluster?.className).not.toContain(
      "group-focus-within/item:opacity-100",
    );
    expect(text).toHaveClass("w-[calc(100%+0.5rem)]");
  });

  it("keeps the actions keyboard reachable", async () => {
    const user = userEvent.setup();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, canResolve: true }}
        onEditItem={vi.fn()}
        onMoveItem={vi.fn()}
        onResolvePlan={vi.fn()}
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit item: Original text" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Update progress for Original text" }),
    ).toHaveFocus();
    await user.tab();
    const more = screen.getByText("More actions");
    expect(more).toHaveFocus();
    await user.click(more);
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Edit details: Original text" }),
    ).toHaveFocus();
  });
});
