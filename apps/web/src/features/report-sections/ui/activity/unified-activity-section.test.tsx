import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import type { UnifiedActivityEntry } from "../../model/activity/unified-activity-entry";
import type { ProductKanbanItem } from "../../model/types";
import { UnifiedActivitySection } from "./unified-activity-section";

function makeItem(
  overrides: Partial<ProductKanbanItem> & { id: string },
): ProductKanbanItem {
  return {
    parent: { kind: "product", id: "p1" },
    productId: "p1",
    productName: "Product 1",
    activityId: null,
    status: "in-progress",
    text: `Item ${overrides.id}`,
    author: "Lead 1",
    stageNames: ["Development"],
    ...overrides,
  };
}

const entries: UnifiedActivityEntry[] = [
  {
    item: makeItem({ id: "i-done", status: "completed" }),
    bucket: "done",
    week: "current",
  },
  {
    item: makeItem({ id: "i-progress" }),
    bucket: "in-progress",
    week: "current",
  },
  {
    item: makeItem({ id: "i-paused", status: "paused" }),
    bucket: "paused",
    week: "current",
  },
  {
    item: makeItem({ id: "i-planned", status: "planned" }),
    bucket: "planned-next",
    week: "next",
  },
  {
    item: makeItem({ id: "i-deferred" }),
    bucket: "deferred",
    week: "next",
  },
];

function findCardByText(text: string): HTMLElement {
  const card = screen
    .getAllByTestId("item-card")
    .find((candidate) => within(candidate).queryByText(text) !== null);
  if (!card) throw new Error(`No item card containing "${text}"`);
  return card;
}

describe("UnifiedActivitySection", () => {
  it("renders one group per non-empty bucket with counts", () => {
    render(<UnifiedActivitySection entries={entries} readOnly />);
    const section = screen.getByTestId("unified-activity-section");
    for (const bucket of [
      "done",
      "in-progress",
      "paused",
      "planned-next",
      "deferred",
    ]) {
      expect(
        within(section).getByTestId(`bucket-label-${bucket}`),
      ).toBeInTheDocument();
    }
    expect(within(section).getAllByTestId("item-card")).toHaveLength(5);
  });

  it("suppresses empty buckets", () => {
    render(
      <UnifiedActivitySection
        entries={entries.filter((entry) => entry.bucket === "done")}
        readOnly
      />,
    );
    expect(screen.getByTestId("bucket-label-done")).toBeInTheDocument();
    expect(
      screen.queryByTestId("bucket-label-deferred"),
    ).not.toBeInTheDocument();
  });

  it("routes a delete to the record's PHYSICAL week list (type storage untouched)", () => {
    const onWeekItemsChange = vi.fn();
    render(
      <UnifiedActivitySection
        entries={entries}
        onWeekItemsChange={onWeekItemsChange}
      />,
    );
    const deferredCard = findCardByText("Item i-deferred");
    fireEvent.click(within(deferredCard).getByLabelText("Delete"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    expect(onWeekItemsChange).toHaveBeenCalledWith("next", [
      expect.objectContaining({ id: "i-planned" }),
    ]);
  });

  it("withholds Delete and shows the marker for a published-lineage record", () => {
    render(
      <UnifiedActivitySection
        entries={entries}
        publishedLockedIds={new Set(["i-progress"])}
        onWeekItemsChange={vi.fn()}
      />,
    );
    const locked = within(findCardByText("Item i-progress"));
    expect(locked.getByText("In published report")).toBeInTheDocument();
    expect(locked.queryByLabelText("Delete")).not.toBeInTheDocument();
  });

  it("offers the move actions on open current-week items only", () => {
    const onMarkComplete = vi.fn();
    const onMoveToNextWeek = vi.fn();
    render(
      <UnifiedActivitySection
        entries={entries}
        onMarkComplete={onMarkComplete}
        onMoveToNextWeek={onMoveToNextWeek}
        onWeekItemsChange={vi.fn()}
      />,
    );
    // Two open current-week entries (in-progress renders before paused per bucket order).
    expect(screen.getAllByLabelText("Mark complete")).toHaveLength(2);
    fireEvent.click(
      expectDefined(screen.getAllByLabelText("Mark complete")[1]),
    );
    expect(onMarkComplete).toHaveBeenCalledWith("i-paused");
    fireEvent.click(
      expectDefined(screen.getAllByLabelText("Move to next week")[1]),
    );
    expect(onMoveToNextWeek).toHaveBeenCalledWith("i-paused");
  });
});
