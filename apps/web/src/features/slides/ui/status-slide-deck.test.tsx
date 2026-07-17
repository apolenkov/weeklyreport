import type { ReportSectionReadModel } from "@customreport/shared";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { buildSectionSlideModel } from "../model/section-slide-model";
import { StatusSlideDeck } from "./status-slide-deck";

type Item = ReportSectionReadModel["items"][number];
type Risk = ReportSectionReadModel["risks"][number];

const STABLE_ID = "stable-item-1";

const itemIds = (() => {
  const counter = { value: 0 };
  return () => {
    counter.value += 1;
    return `fixture-${String(counter.value)}`;
  };
})();

const item = (over: Partial<Item> = {}): Item => ({
  id: itemIds(),
  type: "current",
  text: "own item",
  tag: "",
  workflowStatus: "in_progress",
  carriedOver: false,
  projectId: "p1",
  stageIds: [],
  ...over,
});

const risk = (over: Partial<Risk> = {}): Risk => ({
  id: itemIds(),
  risk: "own risk",
  impact: "",
  mitigation: "",
  severity: "at-risk",
  projectId: "p1",
  stageIds: [],
  ...over,
});

const makeSection = (
  over: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel => ({
  reportSectionId: "sec-1",
  reportId: "rep-1",
  authorId: "lead-1",
  authorName: "Иванов Василий Петрович",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [
    {
      projectId: "p1",
      projectName: "Core Product",
      trafficLight: "green",
      ownedStages: [],
    },
    {
      projectId: "p2",
      projectName: "Data Portal",
      trafficLight: "yellow",
      ownedStages: [],
    },
  ],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
  ...over,
});

function renderDeck(
  section: ReportSectionReadModel,
  mode: "lead" | "head" = "lead",
) {
  const slide = buildSectionSlideModel(section);
  const onSelect = vi.fn();
  render(
    <StatusSlideDeck
      slides={[slide]}
      selectedIndex={0}
      onSelect={onSelect}
      mode={mode}
    />,
  );
  return { onSelect };
}

describe("StatusSlideDeck — by-product grid article", () => {
  it("renders one column-header row and one card per product", () => {
    renderDeck(
      makeSection({
        items: [item(), item({ projectId: "p2", text: "portal item" })],
      }),
    );
    expect(screen.getAllByTestId("slide-column-headers")).toHaveLength(1);
    expect(screen.getAllByTestId("slide-product-card")).toHaveLength(2);
    expect(screen.getByText("own item")).toBeInTheDocument();
    expect(screen.getByText("portal item")).toBeInTheDocument();
  });

  it("renders every row without count-based truncation", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      item({ text: `row number ${String(i)}` }),
    );
    renderDeck(makeSection({ items: many }));
    for (const row of many) {
      expect(screen.getByText(row.text)).toBeInTheDocument();
    }
  });

  it("keeps DOM order Current → Next → Risks → Decisions and dashes empty cells", () => {
    renderDeck(makeSection({ items: [item()] }));
    const card = expectDefined(screen.getAllByTestId("slide-product-card")[0]);
    const cells = within(card).getAllByLabelText(
      /^(No )?(Current work|Next focus|Risks|Decisions)$/,
    );
    expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "Current work",
      "No Next focus",
      "No Risks",
      "No Decisions",
    ]);
    expect(within(card).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("collapses a product with no records into the no-data row", () => {
    renderDeck(makeSection({ items: [item()] }));
    const empty = screen.getByTestId("slide-product-empty");
    expect(empty).toHaveTextContent("Data Portal");
    expect(empty).toHaveTextContent("no status for this period");
  });

  it("shows the author badge only on the first row of a same-author series", () => {
    renderDeck(
      makeSection({
        items: [item({ text: "first" }), item({ text: "second" })],
      }),
    );
    const card = expectDefined(screen.getAllByTestId("slide-product-card")[0]);
    expect(within(card).getAllByTestId("slide-author-badge")).toHaveLength(1);
  });

  it("plays status via marks and highlights, never words", () => {
    renderDeck(
      makeSection({
        items: [
          item({ workflowStatus: "done" }),
          item({ workflowStatus: "paused" }),
          item({ type: "next", workflowStatus: "postponed" }),
        ],
        risks: [
          risk({ risk: "yellow risk" }),
          risk({ risk: "hard blocker", severity: "blocked" }),
        ],
      }),
    );
    // Done/paused/postponed → sr-only status word next to a quiet glyph; risk
    // severity lives in the row background/border with an sr-only label — no
    // visible words anywhere.
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Postponed")).toBeInTheDocument();
    expect(screen.queryByText("IN PROGRESS")).not.toBeInTheDocument();
    expect(screen.queryByText("PLANNED")).not.toBeInTheDocument();
    expect(screen.queryByText("AT RISK")).not.toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("hard blocker")).toBeInTheDocument();
  });

  it("collapses a record-less project subsection to its header row", () => {
    renderDeck(
      makeSection({
        activities: [
          {
            activityId: "act-1",
            activityName: "Поддержка",
            status: "green",
            derivedStatus: null,
            linkedProducts: [{ productId: "p1", productName: "Alpha" }],
          },
        ],
      }),
    );
    expect(screen.getByText("Поддержка")).toBeInTheDocument();
    // No em-dash grid under the status-only project header.
    expect(screen.queryByLabelText("No Current work")).not.toBeInTheDocument();
  });

  it("renders the stage legend for stages present on the slide", () => {
    renderDeck(makeSection({ items: [item({ stageIds: ["Testing"] })] }));
    expect(screen.getByTestId("slide-stage-legend")).toHaveTextContent(
      "Testing",
    );
  });

  it("renders the priority strip ascending", () => {
    renderDeck(
      makeSection({
        items: [
          item({ text: "second priority", priorityRank: 2 }),
          item({ text: "top priority", priorityRank: 1, projectId: "p2" }),
        ],
      }),
    );
    const strip = screen.getByTestId("slide-priority-strip");
    const labels = within(strip)
      .getAllByText(/^P\d$/)
      .map((el) => el.textContent);
    expect(labels).toEqual(["P1", "P2"]);
  });

  it("suppresses the on-track chip when no product carries a status", () => {
    // Stage-less fixtures derive no product status → the chip has no
    // denominator and must self-suppress rather than show "0 of 0".
    renderDeck(
      makeSection({
        items: [item(), item({ projectId: "p2", text: "portal item" })],
      }),
    );
    expect(screen.queryByTestId("slide-on-track-chip")).not.toBeInTheDocument();
  });

  it("renders the legend with the owner's role suffix", () => {
    renderDeck(makeSection({ items: [item()] }));
    expect(screen.getByTestId("slide-legend")).toHaveTextContent("· lead");
  });

  it("always shows every product — no view-mode toggle", () => {
    renderDeck(
      makeSection({
        items: [item(), item({ projectId: "p2", text: "portal item" })],
      }),
    );
    expect(screen.getAllByTestId("slide-product-card")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Product" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Slide view mode" }),
    ).not.toBeInTheDocument();
  });

  it("renders the head deck through the same article", () => {
    renderDeck(makeSection({ items: [item()] }), "head");
    expect(screen.getByTestId("slide-article")).toBeInTheDocument();
    expect(screen.getAllByTestId("slide-column-headers")).toHaveLength(1);
  });

  it("navigates slides with arrow keys", () => {
    const slideA = buildSectionSlideModel(makeSection({ items: [item()] }));
    const slideB = buildSectionSlideModel(
      makeSection({ reportSectionId: "sec-2", authorName: "Петров М.К." }),
    );
    const onSelect = vi.fn();
    render(
      <StatusSlideDeck
        slides={[slideA, slideB]}
        selectedIndex={0}
        onSelect={onSelect}
        mode="lead"
      />,
    );
    fireEvent.keyDown(screen.getByTestId("lead-slides-deck"), {
      key: "ArrowRight",
    });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("shows the empty state when there are no slides", () => {
    render(
      <StatusSlideDeck
        slides={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="head"
      />,
    );
    expect(screen.getByText("No slides available")).toBeInTheDocument();
  });

  it("passes row activation through the lead deck", () => {
    const slide = buildSectionSlideModel(
      makeSection({ items: [item({ stableId: STABLE_ID })] }),
    );
    const onRowActivate = vi.fn();
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="lead"
        onRowActivate={onRowActivate}
      />,
    );

    fireEvent.doubleClick(
      screen.getByRole("button", { name: "Edit In progress: own item" }),
    );

    expect(onRowActivate).toHaveBeenCalledWith({
      kind: "item",
      stableId: STABLE_ID,
    });
  });

  it("does not pass row activation through the head deck", () => {
    const slide = buildSectionSlideModel(
      makeSection({ items: [item({ stableId: STABLE_ID })] }),
    );
    const onRowActivate = vi.fn();
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="head"
        onRowActivate={onRowActivate}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Edit In progress: own item" }),
    ).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByText("own item"));
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  describe("fullscreen persists across slide navigation", () => {
    function setFullscreenElement(el: Element | null) {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: el,
      });
    }

    afterEach(() => {
      setFullscreenElement(null);
    });

    it("keeps the fullscreen overlay active after an ArrowRight slide change", () => {
      const slideA = buildSectionSlideModel(makeSection({ items: [item()] }));
      const slideB = buildSectionSlideModel(
        makeSection({ reportSectionId: "sec-2", authorName: "Петров М.К." }),
      );

      // A controlled wrapper: `StatusSlideDeck` is fully controlled by
      // `selectedIndex`, so the arrow-key navigation only actually changes
      // slides — and can only actually remount the article/frame — if
      // `onSelect` feeds back into the prop, as it does in the real app.
      function ControlledDeck() {
        const [selectedIndex, setSelectedIndex] = useState(0);
        return (
          <StatusSlideDeck
            slides={[slideA, slideB]}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            mode="head"
          />
        );
      }

      render(<ControlledDeck />);

      // Enter fullscreen the same way the deck-level `useFullscreen` owner
      // observes it: via the native `fullscreenchange` event, not the toggle
      // (jsdom does not implement `Element.requestFullscreen`).
      const deck = screen.getByTestId("head-slides-deck");
      const frame = deck.querySelector('[tabindex="-1"]');
      expect(frame).not.toBeNull();
      act(() => {
        setFullscreenElement(frame);
        document.dispatchEvent(new Event("fullscreenchange"));
      });
      expect(
        screen.getByRole("button", { name: "Exit fullscreen" }),
      ).toBeInTheDocument();

      fireEvent.keyDown(deck, { key: "ArrowRight" });

      // If the fullscreened wrapper had been remounted by the navigation, the
      // real Fullscreen API — and this overlay, which self-gates on
      // `isFullscreen` — would drop out. It must still be present.
      expect(
        screen.getByRole("button", { name: "Exit fullscreen" }),
      ).toBeInTheDocument();
    });
  });
});
