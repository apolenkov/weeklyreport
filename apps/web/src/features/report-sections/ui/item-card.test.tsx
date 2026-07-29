/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, RiskEntry } from "../model/types";
import { ItemCard } from "./item-card";

const BASE_ITEM: KanbanItem = {
  id: "item-1",
  productId: "p1",
  productName: "DevOps Tools",
  text: "Implement CI pipeline",
  status: "in-progress",
  author: "Alice Lead",
};

describe("ItemCard — priority rank badge accessibility", () => {
  it("priority rank badge has role='img'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, priorityRank: 2 }} />);
    // Two role="img" elements: priority badge and stage-tags container.
    // Disambiguate by accessible name.
    const badge = screen.getByRole("img", { name: /Priority 2/i });
    expect(badge).toBeInTheDocument();
  });

  it("priority rank badge has aria-label matching 'Priority <rank>'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, priorityRank: 3 }} />);
    const badge = screen.getByRole("img", { name: "Priority 3" });
    expect(badge).toHaveAttribute("aria-label", "Priority 3");
    expect(badge).toHaveStyle({ color: "var(--color-foreground)" });
  });
});

describe("ItemCard — stage tags container accessibility", () => {
  it("stage tags container has role='img'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, stageNames: ["S1", "S2"] }} />);
    const container = screen.getByRole("img", {
      name: /^Item stages:/,
    });
    expect(container).toBeInTheDocument();
  });

  it("stage tags container has aria-label 'Item stages: <stage-list>'", () => {
    render(<ItemCard item={{ ...BASE_ITEM, stageNames: ["S1", "S2"] }} />);
    const container = screen.getByRole("img", {
      name: "Item stages: S1, S2",
    });
    expect(container).toHaveAttribute("aria-label", "Item stages: S1, S2");
  });

  it("stage tags container shows the 'No stage set' warning when no stageNames", () => {
    render(<ItemCard item={{ ...BASE_ITEM, stageNames: [] }} />);
    const container = screen.getByRole("img", {
      name: "Item stages: No stage set",
    });
    expect(container).toHaveAttribute(
      "aria-label",
      "Item stages: No stage set",
    );
    expect(screen.getByText("No stage set")).toBeInTheDocument();
  });

  it("deduplicates legacy stage aliases after canonicalization", () => {
    render(
      <ItemCard item={{ ...BASE_ITEM, stageNames: ["Dev", "Development"] }} />,
    );

    const container = screen.getByRole("img", {
      name: "Item stages: Development",
    });
    expect(within(container).getAllByText("Development")).toHaveLength(1);
  });
});

describe("ItemCard — SVG icon aria-hidden (snapshot)", () => {
  it("EditIcon svg has aria-hidden='true'", () => {
    render(<ItemCard item={BASE_ITEM} onEdit={vi.fn()} />);
    const editButton = screen.getByRole("button", { name: "Edit" });
    const svg = editButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toMatchSnapshot();
  });

  it("DeleteIcon svg has aria-hidden='true'", () => {
    render(<ItemCard item={BASE_ITEM} onDelete={vi.fn()} />);
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    const svg = deleteButton.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toMatchSnapshot();
  });
});

describe("ItemCard — optional actions", () => {
  it("omits Edit and Delete when their callbacks are absent", () => {
    render(<ItemCard item={BASE_ITEM} />);

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("renders working Edit and Delete actions when callbacks are present", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<ItemCard item={BASE_ITEM} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onEdit).toHaveBeenCalledWith(BASE_ITEM.id);
    expect(onDelete).toHaveBeenCalledWith(BASE_ITEM.id);
  });
});

describe("ItemCard — compact touch floor", () => {
  // jsdom cannot evaluate media queries, so the accepted teeth are class
  // assertions: the icon buttons must derive their size from the shared
  // toolbar token (32px on desktop, the 44px touch floor below `md`), never
  // a hard-coded h-8/w-8.
  it.each(["Edit", "Delete"])(
    "%s icon button sizes from the toolbar control token",
    (name) => {
      render(<ItemCard item={BASE_ITEM} onEdit={vi.fn()} onDelete={vi.fn()} />);
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("h-[var(--toolbar-control-h)]");
      expect(button.className).toContain("w-[var(--toolbar-control-h)]");
    },
  );
});

describe("ItemCard — card DOM structure (snapshot)", () => {
  it("renders card with aria-hidden icons and accessible button labels", () => {
    const { container } = render(
      <ItemCard
        item={{ ...BASE_ITEM, priorityRank: 1, stageNames: ["Dev"] }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const card = container.querySelector('[data-testid="item-card"]');
    expect(card).toMatchSnapshot();
  });
});

describe("ItemCard — uniform height", () => {
  // Same fixed height as the section-level empty-state placeholder ("No
  // items yet" in current-week-section.tsx / next-week-section.tsx) — the
  // reference every populated card must match.
  const EMPTY_STATE_REFERENCE_HEIGHT = "150px";

  it("a short card and a long card render at the empty-state reference height", () => {
    const shortItem: KanbanItem = { ...BASE_ITEM, text: "Ship it." };
    const longItem: KanbanItem = {
      ...BASE_ITEM,
      id: "item-2",
      text: "This description runs on for several lines of body copy, the kind of text that, under the old min-height growing-column layout, would push this card taller than a short sibling sitting next to it in the same section.",
    };

    const { container: shortContainer } = render(<ItemCard item={shortItem} />);
    const { container: longContainer } = render(<ItemCard item={longItem} />);

    const shortCard = within(shortContainer).getByTestId("item-card");
    const longCard = within(longContainer).getByTestId("item-card");

    expect(shortCard.style.height).toBe(EMPTY_STATE_REFERENCE_HEIGHT);
    expect(longCard.style.height).toBe(EMPTY_STATE_REFERENCE_HEIGHT);
    expect(shortCard.style.height).toBe(longCard.style.height);
    // The old layout floored on min-height, which a long card could outgrow;
    // the static render is fixed via `height`, never `min-height`.
    expect(shortCard.style.minHeight).toBe("");
    expect(longCard.style.minHeight).toBe("");
  });

  it("the fixed chrome (status pill row, author, stage tags) is never clipped by the reference height", () => {
    const { container } = render(
      <ItemCard
        item={{ ...BASE_ITEM, priorityRank: 1, stageNames: ["S1", "S2"] }}
      />,
    );
    const card = within(container).getByTestId("item-card");
    // Top row (status pill + actions) and footer row (author + stage tags)
    // opt out of the flex column's shrink pressure via `shrink-0`, so the
    // fixed card height never compresses them below their natural size;
    // only the body text region in between (line-clamp-3) is flexible.
    const rows = Array.from(card.children);
    expect(rows[0]).toHaveClass("shrink-0");
    expect(rows[2]).toHaveClass("shrink-0");
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Alice Lead")).toBeInTheDocument();
  });
});

describe("ItemCard — body text truncation + tooltip", () => {
  const LONG_TEXT =
    "A very long piece of item text that keeps going and going and going well past what three clamped lines can comfortably show in the card.";

  it("static render clamps the body text and exposes the full text via a title tooltip", () => {
    render(<ItemCard item={{ ...BASE_ITEM, text: LONG_TEXT }} />);
    const body = screen.getByTitle(LONG_TEXT);
    expect(body).toHaveClass("line-clamp-3");
    expect(body).toHaveTextContent(LONG_TEXT);
  });

  it("inline edit shows the full, untruncated text in the textarea", () => {
    render(<ItemCard item={{ ...BASE_ITEM, text: LONG_TEXT }} isEditing />);
    const textarea = screen.getByRole("textbox", { name: "Edit item text" });
    expect(textarea).toHaveValue(LONG_TEXT);
  });
});

describe("ItemCard — risk-derived alarm status", () => {
  const inProgress: KanbanItem = {
    ...BASE_ITEM,
    stageNames: ["Development"],
    status: "in-progress",
  };
  const risk = (severity: "at-risk" | "blocked"): RiskEntry => ({
    id: `risk-${severity}`,
    productId: "p1",
    productName: "DevOps Tools",
    stageNames: ["Development"],
    severity,
    text: "A real covering risk",
    impact: "impact",
    mitigation: "mitigation",
  });

  it("floors an in-progress item to Blocked when a covering blocked risk exists", () => {
    render(<ItemCard item={inProgress} risks={[risk("blocked")]} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
  });

  it("floors an in-progress item to At Risk when a covering at-risk risk exists", () => {
    render(<ItemCard item={inProgress} risks={[risk("at-risk")]} />);
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it("shows the covered-lock message on a derived alarm pill", () => {
    render(<ItemCard item={inProgress} risks={[risk("blocked")]} />);
    expect(screen.getByText("Blocked")).toHaveAttribute(
      "title",
      "Status is set by the covering risk/blocker — resolve it to change.",
    );
  });

  it("shows the progress status when no risk covers the item", () => {
    render(<ItemCard item={inProgress} risks={[]} />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("never floors a completed item under a covering risk (eligibility)", () => {
    render(
      <ItemCard
        item={{ ...inProgress, status: "completed" }}
        risks={[risk("blocked")]}
      />,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("never floors an activity-parented item", () => {
    render(
      <ItemCard
        item={{
          ...inProgress,
          productId: "",
          activityId: "act-1",
          activityName: "Jira triage",
        }}
        risks={[{ ...risk("blocked"), productId: "" }]}
      />,
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("trusts item.status when no risk set is threaded in (foreign/legacy path)", () => {
    render(<ItemCard item={{ ...inProgress, status: "blocked" }} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("does not derive a foreign item against the viewer's risks (trusts its baked status)", () => {
    // Foreign items are mixed into the own-item arrays and reach the card WITH
    // the section's (viewer's) risks — but must NOT derive against them; the
    // author's overlay is already baked into the foreign item's status.
    render(
      <ItemCard
        item={{ ...inProgress, foreign: true, status: "blocked" }}
        risks={[]}
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});

describe("ItemCard — foreign covering-risk attribution", () => {
  const inProgress: KanbanItem = {
    ...BASE_ITEM,
    stageNames: ["Development"],
    status: "in-progress",
  };
  const risk = (
    overrides: Partial<RiskEntry> & { severity: "at-risk" | "blocked" },
  ): RiskEntry => ({
    id: `risk-${overrides.severity}`,
    productId: "p1",
    productName: "DevOps Tools",
    stageNames: ["Development"],
    text: "A real covering risk",
    impact: "impact",
    mitigation: "mitigation",
    ...overrides,
  });

  it("names the other author when their covering risk floors an own item", () => {
    const foreign = risk({
      severity: "blocked",
      id: "r-foreign",
      foreign: true,
      authorName: "Bob Lead",
    });
    render(<ItemCard item={inProgress} risks={[foreign]} />);
    expect(screen.getByText("Blocked")).toHaveAttribute(
      "title",
      "Status is set by Bob Lead's covering risk/blocker — resolve it with them to change.",
    );
  });

  it("keeps the generic lock when an OWN risk also produces the floor", () => {
    const own = risk({ severity: "blocked" });
    const foreign = risk({
      severity: "blocked",
      id: "r-foreign",
      foreign: true,
      authorName: "Bob Lead",
    });
    render(<ItemCard item={inProgress} risks={[own, foreign]} />);
    expect(screen.getByText("Blocked")).toHaveAttribute(
      "title",
      "Status is set by the covering risk/blocker — resolve it to change.",
    );
  });
});

describe("ItemCard — move-to-current-week action", () => {
  it("renders the Move to current week button when the handler is passed", () => {
    render(<ItemCard item={BASE_ITEM} onMoveToCurrentWeek={() => undefined} />);
    expect(
      screen.getByRole("button", { name: "Move to current week" }),
    ).toBeInTheDocument();
  });

  it("calls onMoveToCurrentWeek with the item id on click", async () => {
    const onMoveToCurrentWeek = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemCard item={BASE_ITEM} onMoveToCurrentWeek={onMoveToCurrentWeek} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Move to current week" }),
    );
    expect(onMoveToCurrentWeek).toHaveBeenCalledWith("item-1");
  });

  it("withholds the action from a completed item", () => {
    render(
      <ItemCard
        item={{ ...BASE_ITEM, status: "completed" }}
        onMoveToCurrentWeek={() => undefined}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Move to current week" }),
    ).toBeNull();
  });
});

describe("ItemCard — pause action and reason display", () => {
  it("shows the Pause button for an in-progress item when the handler is passed", () => {
    render(<ItemCard item={BASE_ITEM} onPause={() => undefined} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("withholds Pause from a non-in-progress item", () => {
    render(
      <ItemCard
        item={{ ...BASE_ITEM, status: "completed" }}
        onPause={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });

  it("calls onPause with the item id", async () => {
    const onPause = vi.fn();
    const user = userEvent.setup();
    render(<ItemCard item={BASE_ITEM} onPause={onPause} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalledWith("item-1");
  });

  it("surfaces the reason on a paused card", () => {
    render(
      <ItemCard
        item={{
          ...BASE_ITEM,
          status: "paused",
          pausedReason: "waiting on a dependency",
        }}
      />,
    );
    expect(
      screen.getByText(/Paused: waiting on a dependency/),
    ).toBeInTheDocument();
  });

  it("shows no paused line when the item is not paused", () => {
    render(<ItemCard item={{ ...BASE_ITEM, pausedReason: "stale value" }} />);
    expect(screen.queryByText(/Paused:/)).toBeNull();
  });
});
