import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import type { CrossAuthorContentRow } from "../../report-sections";
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
  stageNames: [],
  ...over,
});

const risk = (over: Partial<Risk> = {}): Risk => ({
  id: itemIds(),
  risk: "own risk",
  impact: "",
  mitigation: "",
  severity: "at-risk",
  projectId: "p1",
  stageNames: [],
  ...over,
});

const makeSection = (over: ReportSectionFixture = {}): ReportSectionReadModel =>
  makeReportSectionFixture({
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

const foreignContributor = (): CrossAuthorContentRow => ({
  authorId: "lead-2",
  authorName: "Петров Пётр Павлович",
  authorRole: "lead",
  items: [
    {
      id: "foreign-current",
      projectId: "p1",
      type: "current",
      text: "foreign row",
      workflowStatus: "in_progress",
      stageNames: ["Testing"],
    },
  ],
  risks: [],
  decisions: [],
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
  it("keeps the lead carousel slot for a single slide", () => {
    renderDeck(makeSection());

    expect(
      screen.getByRole("group", { name: "Slide carousel controls" }),
    ).toBeVisible();
    expect(screen.getByText("1 / 1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Previous slide" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
  });

  it("keeps the head selector slot for a single slide", () => {
    renderDeck(makeSection(), "head");

    expect(screen.getByTestId("head-slide-carousel")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enter fullscreen" }),
    ).toBeVisible();
  });

  it("does not add a second fullscreen control when the head shell hosts it", () => {
    const slide = buildSectionSlideModel(makeSection());

    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="head"
        isFullscreen={false}
        onToggle={vi.fn()}
        toolbar={<button type="button">Hosted fullscreen</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Hosted fullscreen" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Enter fullscreen" }),
    ).not.toBeInTheDocument();
  });

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
    expect(screen.getByTestId("lead-slides-deck")).toHaveAttribute(
      "data-layout-key",
      "status-slide-deck",
    );
    expect(screen.getByTestId("slide-article")).toHaveAttribute(
      "data-layout-key",
      "slide-article",
    );
  });

  it.each(["lead", "head"] as const)(
    "labels every stacked mobile category on the %s deck without moving records",
    (mode) => {
      renderDeck(
        makeSection({
          items: [item(), item({ type: "next", text: "next item" })],
          risks: [risk()],
          decisions: [
            {
              id: "decision-1",
              text: "own decision",
              owner: "",
              impact: "",
              productId: "p1",
            },
          ],
        }),
        mode,
      );

      expect(screen.getByTestId("slide-article")).toHaveClass(
        "min-w-0",
        "sm:min-w-[var(--slide-canvas-min-w)]",
      );
      expect(screen.getByTestId("slide-column-headers")).toHaveClass(
        "hidden",
        "sm:grid",
      );
      const card = expectDefined(
        screen.getAllByTestId("slide-product-card")[0],
      );
      const headings = within(card).getAllByRole("heading", { level: 4 });
      expect(headings.map((heading) => heading.textContent)).toEqual([
        "Current work",
        "Next focus",
        "Risks",
        "Decisions",
      ]);
      for (const [label, text] of [
        ["Current work", "own item"],
        ["Next focus", "next item"],
        ["Risks", "own risk"],
        ["Decisions", "own decision"],
      ] as const) {
        const heading = within(card).getByRole("heading", { name: label });
        expect(heading).toHaveClass("sm:hidden");
        expect(heading.parentElement?.parentElement).toHaveClass(
          "grid-cols-1",
          "sm:grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr]",
        );
        expect(heading.parentElement).toContainElement(
          within(card).getByLabelText(label),
        );
        expect(within(card).getByLabelText(label)).toHaveTextContent(text);
      }
    },
  );

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

  it("shows the record author on every row of a same-author series", () => {
    renderDeck(
      makeSection({
        items: [item({ text: "first" }), item({ text: "second" })],
      }),
    );
    const card = expectDefined(screen.getAllByTestId("slide-product-card")[0]);
    expect(within(card).getAllByTestId("slide-author-badge")).toHaveLength(2);
  });

  it("keeps row attribution while omitting scope-level owner marks in Mine", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        items: [item({ text: "mine row", priorityRank: 1 })],
      }),
      { showOwnerBadges: false },
    );
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="lead"
      />,
    );

    expect(screen.getAllByText("mine row")).toHaveLength(2);
    expect(screen.getByTestId("slide-author-badge")).toHaveTextContent("ИВ");
    expect(
      screen.queryByTestId("slide-priority-author-badge"),
    ).not.toBeInTheDocument();
    const mineRankBadge = screen.getByTestId("slide-priority-rank-badge");
    expect(mineRankBadge).toHaveStyle({
      background: "var(--color-priority-row-bg)",
    });
    expect(mineRankBadge).not.toHaveStyle({
      background: "var(--slide-author-0)",
    });
    expect(screen.queryByTestId("slide-legend")).not.toBeInTheDocument();
  });

  it("keeps owner and contributor attribution across an Everyone slide model", () => {
    const slide = buildSectionSlideModel(
      makeSection({
        items: [item({ text: "everyone row", priorityRank: 1 })],
      }),
      { foreign: [foreignContributor()], showOwnerBadges: true },
    );
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="lead"
      />,
    );

    const authorBadges = screen.getAllByTestId("slide-author-badge");
    expect(authorBadges).toHaveLength(2);
    const ownerBadge = expectDefined(
      authorBadges.find((badge) => badge.textContent.includes("ИВ")),
    );
    expect(ownerBadge).toHaveStyle({
      background: "var(--slide-author-0)",
    });
    expect(ownerBadge).toHaveTextContent("ИВ");
    const contributorBadge = expectDefined(
      authorBadges.find((badge) => badge.textContent.includes("ПП")),
    );
    expect(contributorBadge).toHaveStyle({
      background: "var(--slide-author-1)",
    });
    expect(contributorBadge).toHaveTextContent("ПП");

    const priorityAuthorBadge = screen.getByTestId(
      "slide-priority-author-badge",
    );
    expect(priorityAuthorBadge).toHaveStyle({
      background: "var(--slide-author-0)",
    });
    expect(priorityAuthorBadge).toHaveTextContent("ИВ");
    expect(screen.getByTestId("slide-priority-rank-badge")).toHaveStyle({
      background: "var(--slide-author-0)",
    });
    expect(screen.getByTestId("slide-legend")).toHaveTextContent("Иванов В.П.");
    expect(screen.getByTestId("slide-legend")).toHaveTextContent("Петров П.П.");
  });

  it("keeps multi-author attribution in the shared Head/Viewer deck", () => {
    const slide = buildSectionSlideModel(
      makeSection({ items: [item({ text: "owner row" })] }),
      { foreign: [foreignContributor()] },
    );
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="head"
      />,
    );

    expect(screen.getAllByTestId("slide-author-badge")).toHaveLength(2);
    expect(screen.getByTestId("slide-legend")).toHaveTextContent("Иванов В.П.");
    expect(screen.getByTestId("slide-legend")).toHaveTextContent("Петров П.П.");
  });

  it("keeps the wide lead canvas inside a local horizontal scroll host", () => {
    renderDeck(makeSection({ items: [item()] }));

    expect(screen.getByTestId("lead-slides-deck")).toHaveClass(
      "min-w-0",
      "max-w-full",
    );
    expect(screen.getByTestId("lead-slide-scroll-host")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "relative",
      "overflow-x-auto",
    );
  });

  it("keeps the wide head canvas inside an identified local scroll host", () => {
    renderDeck(makeSection({ items: [item()] }), "head");

    const host = screen.getByTestId("head-slide-scroll-host");
    expect(host).toHaveClass("relative", "overflow-auto");
    expect(host).toContainElement(screen.getByTestId("slide-article"));
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
    renderDeck(makeSection({ items: [item({ stageNames: ["Testing"] })] }));
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

  it("preserves arrow-key editing in hero controls", () => {
    const slide = buildSectionSlideModel(makeSection({ items: [item()] }));
    const onSelect = vi.fn();
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={onSelect}
        mode="lead"
        heroControls={
          <>
            <input aria-label="Inline title" />
            <textarea aria-label="Inline notes" />
            <select aria-label="Inline scope">
              <option>own</option>
              <option>product</option>
            </select>
            <div contentEditable aria-label="Inline rich text" />
          </>
        }
      />,
    );

    for (const control of [
      screen.getByRole("textbox", { name: "Inline title" }),
      screen.getByRole("textbox", { name: "Inline notes" }),
      screen.getByRole("combobox", { name: "Inline scope" }),
      screen.getByLabelText("Inline rich text"),
    ]) {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      fireEvent(control, event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("prevents the browser default when an arrow key navigates the deck", () => {
    const slide = buildSectionSlideModel(makeSection({ items: [item()] }));
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={vi.fn()}
        mode="lead"
      />,
    );
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });

    fireEvent(screen.getByTestId("lead-slides-deck"), event);

    expect(event.defaultPrevented).toBe(true);
  });

  // C5189 (TASK-503.41): a modified arrow belongs to the browser/AT; the deck
  // must not page on it and must leave the event unprevented.
  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
  ])("leaves a modified arrow key to the browser and AT: %o", (modifier) => {
    const slide = buildSectionSlideModel(makeSection({ items: [item()] }));
    const onSelect = vi.fn();
    render(
      <StatusSlideDeck
        slides={[slide]}
        selectedIndex={0}
        onSelect={onSelect}
        mode="lead"
      />,
    );
    const deck = screen.getByTestId("lead-slides-deck");

    for (const key of ["ArrowRight", "ArrowLeft"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...modifier,
      });
      fireEvent(deck, event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onSelect).not.toHaveBeenCalled();
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

  it("emits no selection index on an empty deck", () => {
    const onSelect = vi.fn();
    render(
      <StatusSlideDeck
        slides={[]}
        selectedIndex={0}
        onSelect={onSelect}
        mode="lead"
      />,
    );
    const deck = screen.getByTestId("lead-slides-deck");

    fireEvent.keyDown(deck, { key: "ArrowRight" });
    fireEvent.keyDown(deck, { key: "ArrowLeft" });

    expect(onSelect).not.toHaveBeenCalled();
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
      screen.getByRole("button", {
        name: "Expand full details for In progress: own item",
      }),
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

  describe("fullscreen overlay state during slide navigation", () => {
    function setFullscreenElement(el: Element | null) {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: el,
      });
    }

    afterEach(() => {
      setFullscreenElement(null);
    });

    it("keeps the overlay active after navigation while fullscreenElement remains set", () => {
      const slideA = buildSectionSlideModel(makeSection({ items: [item()] }));
      const slideB = buildSectionSlideModel(
        makeSection({ reportSectionId: "sec-2", authorName: "Петров М.К." }),
      );

      // Feed onSelect back into the controlled selectedIndex prop so the key
      // event changes the rendered slide during this component test.
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

      // jsdom lacks requestFullscreen, so set its observable document state
      // and dispatch the event consumed by the deck hook.
      const deck = screen.getByTestId("head-slides-deck");
      const frame = deck.querySelector('[tabindex="-1"]');
      expect(frame).not.toBeNull();
      act(() => {
        setFullscreenElement(frame);
        document.dispatchEvent(new Event("fullscreenchange"));
      });
      expect(
        screen.getAllByRole("button", { name: "Exit fullscreen" }),
      ).toHaveLength(2);

      fireEvent.keyDown(deck, { key: "ArrowRight" });

      // The overlay follows the mocked fullscreen state across the controlled
      // slide change. Native Fullscreen API persistence is browser-owned.
      expect(
        screen.getAllByRole("button", { name: "Exit fullscreen" }),
      ).toHaveLength(2);
    });
  });
});
