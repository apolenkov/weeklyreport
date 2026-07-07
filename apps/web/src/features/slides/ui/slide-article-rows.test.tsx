import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
