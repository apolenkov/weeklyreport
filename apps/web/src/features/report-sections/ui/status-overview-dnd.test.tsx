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
function pointerInit(x: number, y: number) {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    isPrimary: true,
    button: 0,
    bubbles: true,
  };
}

async function dragCard(from: { x: number; y: number }, toX: number) {
  const card = document.querySelector<HTMLElement>("[data-draggable-item]");
  if (!card) throw new Error("Expected a draggable card");
  fireEvent.pointerDown(card, pointerInit(from.x, from.y));
  fireEvent.pointerMove(document, pointerInit(from.x + 10, from.y));
  fireEvent.pointerMove(document, pointerInit(toX, from.y));
  // Collision detection settles on the next frame; let the microtasks and the
  // frame run before the release.
  await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
  fireEvent.pointerUp(document, pointerInit(toX, from.y));
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
    expect(draggable[0]).toHaveTextContent("Work item 1");
    expect(
      screen.getByText("Prior plan").closest("[data-draggable-item]"),
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

  it("ignores a drop back on the same lane or onto Previous", async () => {
    stubLayout();
    const onMoveItem = vi.fn();
    render(<StatusOverview model={dndModel()} onMoveItem={onMoveItem} />);

    await dragCard({ x: 250, y: 140 }, 50);
    await dragCard({ x: 250, y: 140 }, 250);

    expect(onMoveItem).not.toHaveBeenCalled();
  });
});
