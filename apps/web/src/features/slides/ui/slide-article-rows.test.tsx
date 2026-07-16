import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider } from "../../../shared/ui/sdlc-tooltip";
import type {
  GridAuthor,
  GridRow,
  SlideGridModel,
} from "../model/slide-grid-model";
import { SlidePriorityStrip } from "./slide-article-header";
import { SlideCell } from "./slide-article-rows";

const AUTHOR: GridAuthor = {
  id: "author-1",
  name: "Вадим Иванов",
  initials: "ВИ",
  colorIndex: 2,
  isOwner: true,
};

const authorsById = new Map<string, GridAuthor>([[AUTHOR.id, AUTHOR]]);

const ROW: GridRow = {
  id: "row-1",
  text: "A long onboarding write-up that clamps at two lines on the slide",
  authorId: AUTHOR.id,
  showAuthorBadge: false,
  tone: "paused",
  hoverLabel: "Paused",
  stageNames: [],
};

describe("SlideCell row hover", () => {
  it("shows the status AND the full row text in the tooltip", async () => {
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[ROW]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
        />
      </SdlcTooltipProvider>,
    );
    fireEvent.mouseEnter(screen.getByRole("listitem"));
    const tooltip = await screen.findByTestId("sdlc-tooltip");
    expect(tooltip.textContent).toContain("Paused");
    expect(tooltip.textContent).toContain(ROW.text);
  });

  it("activates editable rows on double-click and Enter", () => {
    const onRowActivate = vi.fn();
    const editableRow: GridRow = {
      ...ROW,
      editableRef: { kind: "item", stableId: "item-stable-1" },
    };
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[editableRow]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
          onRowActivate={onRowActivate}
        />
      </SdlcTooltipProvider>,
    );
    const button = screen.getByRole("button", { name: /edit paused/i });
    fireEvent.doubleClick(button);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onRowActivate).toHaveBeenCalledTimes(2);
    expect(onRowActivate).toHaveBeenNthCalledWith(1, {
      kind: "item",
      stableId: "item-stable-1",
    });
  });

  it("activates editable rows on Space and prevents the default page scroll", () => {
    const onRowActivate = vi.fn();
    const editableRow: GridRow = {
      ...ROW,
      editableRef: { kind: "item", stableId: "item-stable-1" },
    };
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[editableRow]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
          onRowActivate={onRowActivate}
        />
      </SdlcTooltipProvider>,
    );
    const button = screen.getByRole("button", { name: /edit paused/i });
    const event = fireEvent.keyDown(button, { key: " " });
    expect(onRowActivate).toHaveBeenCalledWith({
      kind: "item",
      stableId: "item-stable-1",
    });
    // fireEvent.keyDown returns false when the dispatched event's default was
    // prevented — Space's native default (page scroll) must be suppressed.
    expect(event).toBe(false);
  });

  it("keeps rows inert when the activation handler or editable ref is absent", () => {
    const onRowActivate = vi.fn();
    const editableRow: GridRow = {
      ...ROW,
      editableRef: { kind: "item", stableId: "item-stable-1" },
    };
    const { rerender } = render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[editableRow]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
        />
      </SdlcTooltipProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[ROW]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
          onRowActivate={onRowActivate}
        />
      </SdlcTooltipProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(onRowActivate).not.toHaveBeenCalled();
  });
});

describe("SlidePriorityStrip rank badge", () => {
  const grid: SlideGridModel = {
    authors: [AUTHOR],
    worstStatus: "green",
    counters: { current: 0, risks: 0, priorities: 1 },
    onTrack: { on: 1, total: 1 },
    priorityStrip: [
      {
        id: "prio-1",
        productId: "product-1",
        rank: 2,
        text: "Ship the export",
        productName: "Portal",
        authorId: AUTHOR.id,
      },
    ],
    products: [],
  };

  it("wears the author's identity color with dark foreground text", () => {
    render(<SlidePriorityStrip grid={grid} authorsById={authorsById} />);
    const badge = screen.getByText("P2");
    expect(badge).toHaveStyle({ background: "var(--slide-author-2)" });
    expect(badge.className).toContain("text-[var(--color-foreground)]");
    expect(badge.className).not.toContain("text-white");
  });
});
