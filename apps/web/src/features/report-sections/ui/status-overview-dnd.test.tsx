import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import type { StatusOverviewModel } from "../model/status-overview";
import { resolveDrop } from "../model/status-overview-dnd";
import { StatusOverview } from "./status-overview";

function currentItem(overrides: Partial<StatusOverviewItem> = {}) {
  const item: StatusOverviewItem = {
    key: "current:item-1",
    recordId: "item-1",
    source: "current",
    editTarget: { recordId: "item-1", source: "current" },
    stableId: "item-1",
    text: "Work item 1",
    tag: "delivery",
    stageNames: [],
    pausedReason: null,
    resolution: null,
    outcomeHistory: [],
    comments: [],
    canResolve: false,
    canRestore: false,
    workflowStatus: "in_progress",
    needsConfirmation: false,
    continuity: "continued",
    ...overrides,
  };
  return item;
}

function dndModel(): StatusOverviewModel {
  return {
    periods: {
      previouslyPlanned: "24–30 Aug 2026",
      currentWeek: "31 Aug–6 Sep 2026",
      nextWeek: "7–13 Sep 2026",
    },
    previousPlanSource: "published",
    sourceCounts: { previouslyPlanned: 1, currentWeek: 1, nextWeek: 0 },
    units: [
      {
        key: "product:project-1",
        id: "project-1",
        kind: "product",
        name: "Payments",
        historical: false,
        status: "on-track",
        stages: [],
        linkedProducts: [],
        columns: {
          previouslyPlanned: {
            availability: "available",
            items: [
              currentItem({
                key: "previous:item-9",
                recordId: "item-9",
                source: "previous",
                editTarget: null,
                stableId: "item-9",
                text: "Prior plan",
                canResolve: true,
                workflowStatus: "planned",
                continuity: null,
              }),
            ],
          },
          currentWeek: { availability: "available", items: [currentItem()] },
          nextWeek: { availability: "available", items: [] },
        },
      },
    ],
  };
}

describe("resolveDrop", () => {
  it("returns the other active week for an eligible item", () => {
    expect(resolveDrop(currentItem(), "next")).toBe("next");
    expect(
      resolveDrop(
        currentItem({ source: "next", key: "next:item-1" }),
        "current",
      ),
    ).toBe("current");
  });

  it("rejects drops on the same lane, Previous and the void", () => {
    expect(resolveDrop(currentItem(), "current")).toBeNull();
    expect(resolveDrop(currentItem(), "previous")).toBeNull();
    expect(resolveDrop(currentItem(), undefined)).toBeNull();
    expect(resolveDrop(undefined, "next")).toBeNull();
  });

  it("rejects items that may not move", () => {
    expect(
      resolveDrop(
        currentItem({ source: "previous", editTarget: null }),
        "current",
      ),
    ).toBeNull();
    expect(
      resolveDrop(currentItem({ workflowStatus: "done" }), "next"),
    ).toBeNull();
    expect(resolveDrop(currentItem({ editTarget: null }), "next")).toBeNull();
  });
});

// jsdom has no layout: lanes get deterministic horizontal slots so the real
// collision detection can resolve the drop zone from pointer coordinates.
const LANE_X: Record<string, number> = {
  previous: 0,
  current: 200,
  next: 400,
};

function stubLayout() {
  return vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const element = this as HTMLElement;
      const lane = element.dataset.overviewLineageLane;
      const x =
        element.dataset.draggableItem !== undefined
          ? 210
          : lane !== undefined
            ? (LANE_X[lane] ?? 0)
            : 0;
      const rect = {
        x,
        y: 100,
        width: 150,
        height: 80,
        top: 100,
        right: x + 150,
        bottom: 180,
        left: x,
        toJSON: () => ({}),
      };
      return rect;
    });
}

// PointerSensor arms only on a primary left-button pointer, so the synthetic
// events must say so explicitly (jsdom defaults isPrimary to false).
function pointerInit(x: number, y: number, pointerType = "mouse") {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
    bubbles: true,
  };
}

async function dragCard(
  from: { x: number; y: number },
  toX: number,
  pointerType = "mouse",
) {
  const card = document.querySelector<HTMLElement>("[data-draggable-item]");
  if (!card) throw new Error("Expected a draggable card");
  // Only the grip arms the drag; the card body keeps ordinary gestures.
  const handle = card.querySelector<HTMLElement>(
    'button[aria-label="Drag to move to another week"]',
  );
  if (!handle) throw new Error("Expected a drag handle on the card");
  fireEvent.pointerDown(handle, pointerInit(from.x, from.y, pointerType));
  fireEvent.pointerMove(
    document,
    pointerInit(from.x + 10, from.y, pointerType),
  );
  fireEvent.pointerMove(document, pointerInit(toX, from.y, pointerType));
  // Collision detection settles on the next frame; let the microtasks and the
  // frame run before the release.
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
  fireEvent.pointerUp(document, pointerInit(toX, from.y, pointerType));
}

describe("StatusOverview drag and drop", () => {
  afterEach(() => vi.restoreAllMocks());

  it("marks editable cards draggable and keeps Previous inert", () => {
    render(<StatusOverview model={dndModel()} onMoveItem={vi.fn()} />);
    const previews = screen.getAllByRole("group");
    const draggable = previews.filter(
      (element) => element.dataset.draggableItem !== undefined,
    );
    expect(draggable).toHaveLength(1);
    const movable = draggable[0];
    if (!movable) throw new Error("Expected one movable card");
    expect(movable).toHaveTextContent("Work item 1");
    // The grip is the only drag start, and only the movable card gets one.
    expect(
      movable.querySelector(
        'button[aria-label="Drag to move to another week"]',
      ),
    ).not.toBeNull();
    expect(
      screen.getByText("Prior plan").closest("[data-draggable-item]"),
    ).toBeNull();
    expect(
      screen
        .getByText("Prior plan")
        .closest<HTMLElement>("[data-overview-item-preview]")
        ?.querySelector('button[aria-label="Drag to move to another week"]'),
    ).toBeNull();
  });

  it("moves a Current card dropped onto the Next lane", async () => {
    stubLayout();
    const onMoveItem = vi.fn();
    render(<StatusOverview model={dndModel()} onMoveItem={onMoveItem} />);

    await dragCard({ x: 250, y: 140 }, 450);

    expect(onMoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Work item 1", source: "current" }),
      "next",
      "move:current:item-1",
    );
  });

  it("starts no drag from a plain touch swipe on the handle", async () => {
    stubLayout();
    const onMoveItem = vi.fn();
    render(<StatusOverview model={dndModel()} onMoveItem={onMoveItem} />);

    // A touch drag needs the TouchSensor long press; the pointer events a
    // touch also emits must not arm the distance-based sensor.
    await dragCard({ x: 250, y: 140 }, 450, "touch");

    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("ignores a drop back on the same lane or onto Previous", async () => {
    stubLayout();
    const onMoveItem = vi.fn();
    render(<StatusOverview model={dndModel()} onMoveItem={onMoveItem} />);

    await dragCard({ x: 250, y: 140 }, 50);
    await dragCard({ x: 250, y: 140 }, 250);

    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("leaves a card in its Current lane after a drop on Previous or outside the lanes", async () => {
    stubLayout();
    const onMoveItem = vi.fn();
    render(<StatusOverview model={dndModel()} onMoveItem={onMoveItem} />);
    // The lanes render twice (mobile and desktop copies), so the lane is found
    // from the card itself: it must still sit in a Current lane after the drag.
    const laneOfCard = () => {
      const lane = screen
        .getByText("Work item 1")
        .closest<HTMLElement>("[data-overview-lineage-lane]");
      if (!lane) throw new Error("Expected the card inside a lane");
      return lane;
    };

    await dragCard({ x: 250, y: 140 }, 50);
    expect(laneOfCard()).toHaveAttribute(
      "data-overview-lineage-lane",
      "current",
    );

    // x=800 lies beyond every lane, so no drop zone is hit at all.
    await dragCard({ x: 250, y: 140 }, 800);
    expect(laneOfCard()).toHaveAttribute(
      "data-overview-lineage-lane",
      "current",
    );

    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("does not start a drag from the card body, only from the grip", async () => {
    stubLayout();
    const onMoveItem = vi.fn();
    render(<StatusOverview model={dndModel()} onMoveItem={onMoveItem} />);
    const body = screen.getByText("Work item 1");

    fireEvent.pointerDown(body, pointerInit(250, 140));
    fireEvent.pointerMove(document, pointerInit(260, 140));
    fireEvent.pointerMove(document, pointerInit(450, 140));
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    fireEvent.pointerUp(document, pointerInit(450, 140));

    expect(onMoveItem).not.toHaveBeenCalled();
  });
});
