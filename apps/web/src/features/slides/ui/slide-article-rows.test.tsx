import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider } from "../../../shared/ui/feedback/sdlc-tooltip";
import type {
  GridAuthor,
  GridRow,
  SlideGridModel,
} from "../model/slide-grid-model";
import { SlidePriorityStrip } from "./slide-article-header";
import { SlideCell } from "./slide-article-rows";
import { AuthorBadge } from "./slide-row-marks";

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
  tone: "paused",
  hoverLabel: "Paused",
  stageNames: [],
};

describe("AuthorBadge tooltip", () => {
  it("uses the canonical short name and role", async () => {
    render(
      <SdlcTooltipProvider>
        <AuthorBadge
          author={{ ...AUTHOR, name: "Иванов Василий Петрович", role: "Lead" }}
        />
      </SdlcTooltipProvider>,
    );
    fireEvent.mouseEnter(screen.getByTestId("slide-author-badge"));
    const tooltip = await screen.findByTestId("sdlc-tooltip");
    expect(tooltip).toHaveTextContent("Иванов В.П. · Lead");
    expect(tooltip).not.toHaveTextContent("Василий");
  });
});

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

  it("opens editable rows on double-click and through the expanded Edit action", async () => {
    const user = userEvent.setup();
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
    const disclosure = screen.getByRole("button", {
      name: /expand full details for paused/i,
    });
    await user.dblClick(disclosure);
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate).toHaveBeenNthCalledWith(1, {
      kind: "item",
      stableId: "item-stable-1",
    });

    await user.click(disclosure);
    await user.click(screen.getByRole("button", { name: /edit paused/i }));
    expect(onRowActivate).toHaveBeenCalledTimes(2);
  });

  it("keeps full risk prose open for keyboard reading and restores disclosure focus on Escape", async () => {
    const user = userEvent.setup();
    const riskRow: GridRow = {
      ...ROW,
      id: "risk-1",
      text: "A release dependency with enough context to require persistent reading",
      tone: "at-risk",
      hoverLabel: "At risk",
      details: [
        { label: "Impact", text: "The customer rollout pauses" },
        { label: "Mitigation", text: "Escalate to the platform lead" },
      ],
    };
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[riskRow]}
          authorsById={authorsById}
          showStages={false}
          label="Risks"
        />
      </SdlcTooltipProvider>,
    );

    const disclosure = screen.getByRole("button", {
      name: /expand full details for at risk/i,
    });
    const controlledId = disclosure.getAttribute("aria-controls");
    expect(controlledId).not.toBeNull();
    const controlled = document.getElementById(controlledId ?? "");
    expect(controlled).not.toBeNull();
    expect(screen.getByText(riskRow.text)).toHaveClass(
      "line-clamp-4",
      "md:line-clamp-2",
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    fireEvent.mouseEnter(screen.getByRole("listitem"));
    const tooltip = await screen.findByTestId("sdlc-tooltip");
    expect(tooltip).toHaveTextContent("Impact: The customer rollout pauses");
    expect(tooltip).toHaveTextContent(
      "Mitigation: Escalate to the platform lead",
    );
    fireEvent.mouseLeave(screen.getByRole("listitem"));

    await user.tab();
    expect(disclosure).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(riskRow.text)).not.toHaveClass("line-clamp-4");
    expect(screen.getByText("The customer rollout pauses")).toBeVisible();
    expect(screen.getByText("Escalate to the platform lead")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveFocus();
    expect(controlled).not.toBeVisible();
    expect(screen.queryByText("The customer rollout pauses")).toBeNull();
  });

  it.each([
    ["Next", "Prepare a detailed rollout and support handoff"],
    ["Decision", "Keep the current release window and fallback"],
  ])(
    "offers the same persistent disclosure for long %s rows",
    (label, text) => {
      render(
        <SdlcTooltipProvider>
          <SlideCell
            rows={[{ ...ROW, id: label, text, hoverLabel: label }]}
            authorsById={authorsById}
            showStages={false}
            label={label}
          />
        </SdlcTooltipProvider>,
      );

      expect(
        screen.getByRole("button", {
          name: new RegExp(`expand full details for ${label}`, "i"),
        }),
      ).toHaveAttribute("aria-expanded", "false");
    },
  );

  it("keeps disclosure separate from editable row activation", async () => {
    const user = userEvent.setup();
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

    await user.click(
      screen.getByRole("button", { name: /expand full details for paused/i }),
    );
    expect(onRowActivate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /edit paused/i }),
    ).toBeInTheDocument();
  });

  it("uses Space to read an editable row without opening the editor", async () => {
    const user = userEvent.setup();
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
    const disclosure = screen.getByRole("button", {
      name: /expand full details for paused/i,
    });
    await user.tab();
    expect(disclosure).toHaveFocus();
    await user.keyboard(" ");
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(onRowActivate).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("button", { name: /edit paused/i })).toBeNull();

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
    expect(screen.queryByRole("button", { name: /edit paused/i })).toBeNull();
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it("surfaces an unknown-author fallback badge instead of dropping the marker", () => {
    const orphanRow: GridRow = {
      ...ROW,
      id: "row-orphan",
      authorId: "author-not-in-roster",
    };
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[orphanRow]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
        />
      </SdlcTooltipProvider>,
    );

    const badge = screen.getByTestId("slide-author-badge");
    expect(badge).toHaveTextContent("?");
    expect(badge).toHaveTextContent("Unknown author");
  });

  it("exposes empty cell with role='img' and aria-label for AT (C5197)", () => {
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[]}
          authorsById={authorsById}
          showStages={false}
          label="Risks"
        />
      </SdlcTooltipProvider>,
    );

    const placeholder = screen.getByRole("img", { name: "No Risks" });
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("aria-label", "No Risks");
    expect(placeholder.querySelector(".max-sm\\:hidden")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(placeholder.querySelector(".sm\\:hidden")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it.each(["Current work", "Next focus", "Risks", "Decisions"])(
    "keeps %s prose in the left lane and persistent marks in the right rail",
    (label) => {
      render(
        <SdlcTooltipProvider>
          <SlideCell
            rows={[
              {
                ...ROW,
                tone: "completed",
                stageNames: ["Analysis", "Development", "Testing"],
              },
            ]}
            authorsById={authorsById}
            showStages
            label={label}
          />
        </SdlcTooltipProvider>,
      );

      const content = screen.getByTestId("slide-row-content");
      const metadata = screen.getByTestId("slide-row-metadata");
      const top = within(metadata).getByTestId("slide-row-metadata-top");
      const bottom = within(metadata).getByTestId("slide-row-metadata-bottom");

      expect(content).toHaveTextContent(ROW.text);
      expect(within(content).queryByTestId("slide-author-badge")).toBeNull();
      expect(within(top).queryByRole("button")).toBeNull();
      expect(within(top).getByTestId("slide-author-badge")).toHaveTextContent(
        AUTHOR.initials,
      );
      const stages = within(bottom).getByTestId("slide-stage-watermarks");
      expect(stages).toBeVisible();
      expect(stages.querySelectorAll("svg")).toHaveLength(3);
      expect(within(bottom).queryByTestId("slide-tone-mark")).toBeNull();
    },
  );

  it("shows the record author on every row in a repeated series", () => {
    render(
      <SdlcTooltipProvider>
        <SlideCell
          rows={[
            ROW,
            { ...ROW, id: "row-2", text: "A second row by the same author" },
          ]}
          authorsById={authorsById}
          showStages={false}
          label="Current work"
        />
      </SdlcTooltipProvider>,
    );

    expect(screen.getAllByTestId("slide-author-badge")).toHaveLength(2);
  });
});

describe("SlidePriorityStrip rank badge", () => {
  const grid: SlideGridModel = {
    authors: [AUTHOR],
    showOwnerMarks: true,
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

// TASK-503.73 / C5180: a tooltip belongs to its anchor; the provider keeps it
// until hide/scroll/resize, and an unmounted anchor never fires mouseleave.
describe("hovered anchor lifetime", () => {
  function renderDeck(rows: readonly GridRow[], withBadge: boolean) {
    return (
      <SdlcTooltipProvider>
        <SlideCell
          rows={rows}
          authorsById={authorsById}
          showStages={false}
          label="Next focus"
        />
        {withBadge ? <AuthorBadge author={AUTHOR} /> : null}
      </SdlcTooltipProvider>
    );
  }

  it("removes the row tooltip when the hovered row leaves the list", async () => {
    const { rerender } = render(renderDeck([ROW], false));
    fireEvent.mouseEnter(screen.getByRole("listitem"));
    expect(await screen.findByTestId("sdlc-tooltip")).toBeInTheDocument();

    rerender(renderDeck([], false));

    expect(screen.queryByTestId("sdlc-tooltip")).toBeNull();
  });

  it("keeps a hovered row's tooltip when an unrelated anchor unmounts", async () => {
    const { rerender } = render(renderDeck([ROW], true));
    fireEvent.mouseEnter(screen.getByRole("listitem"));
    expect(await screen.findByTestId("sdlc-tooltip")).toBeInTheDocument();

    rerender(renderDeck([ROW], false));

    expect(screen.getByTestId("sdlc-tooltip")).toBeInTheDocument();
  });
});
