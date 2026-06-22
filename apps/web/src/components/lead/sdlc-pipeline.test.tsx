/**
 * @vitest-environment jsdom
 *
 * rethink-pipeline-state-vs-completeness: the left edge carries ONLY product
 * health (always solid). Own-input completeness is a SEPARATE right-side
 * affordance (dashed ring + "N/M stages" counter) and never shares the health
 * hue. Tests prove the two signals are independent across all four quadrants.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Product } from "./mock-data";
import { getProductCardStyle, SdlcPipeline } from "./sdlc-pipeline";

// ---- Unit: getProductCardStyle (health-only, always solid) ----

describe("getProductCardStyle — health-only solid left edge", () => {
  it("left border is always solid, never dashed", () => {
    expect(getProductCardStyle("on-track").borderLeft).toContain("solid");
    expect(getProductCardStyle("on-track").borderLeft).not.toContain("dashed");
    expect(getProductCardStyle("blocked").borderLeft).not.toContain("dashed");
  });

  it("color token reflects health status", () => {
    expect(getProductCardStyle("on-track").borderLeft).toContain(
      "var(--color-chip-on-track-border)",
    );
    expect(getProductCardStyle("blocked").borderLeft).toContain(
      "var(--color-chip-blocked-border)",
    );
    expect(getProductCardStyle("empty").borderLeft).toContain(
      "var(--color-border)",
    );
  });
});

// ---- Component: SdlcPipeline stripe mode ----

const BASE_PRODUCT: Product = {
  id: "p1",
  name: "Product Alpha",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Design",
      status: "on-track",
      ownership: "mine",
      assignee: "me",
    },
    { stageName: "Dev", status: "on-track", ownership: "mine", assignee: "me" },
  ],
};

const PRODUCT_WITH_UNFILLED_OWN_STAGE: Product = {
  ...BASE_PRODUCT,
  stages: [
    { stageName: "Design", status: "empty", ownership: "mine", assignee: "me" },
    { stageName: "Dev", status: "on-track", ownership: "mine", assignee: "me" },
  ],
};

const PRODUCT_WITH_ALL_FILLED: Product = {
  ...BASE_PRODUCT,
  stages: [
    {
      stageName: "Design",
      status: "on-track",
      ownership: "mine",
      assignee: "me",
    },
    { stageName: "Dev", status: "blocked", ownership: "mine", assignee: "me" },
  ],
};

const PRODUCT_UNFILLED_BUT_NOT_MINE: Product = {
  ...BASE_PRODUCT,
  stages: [
    {
      stageName: "Design",
      status: "empty",
      ownership: "unassigned",
      assignee: null,
    },
    { stageName: "Dev", status: "on-track", ownership: "mine", assignee: "me" },
  ],
};

function getFirstCardStyle(container: HTMLElement): string {
  const card = container.querySelector(".rounded-xl");
  return (card as HTMLElement | null)?.getAttribute("style") ?? "";
}

// ---- Component: SdlcPipeline D1 live stripe color from own stages ----

describe("SdlcPipeline — D1 live stripe color from own stages", () => {
  it("stripe is blocked color when one own stage is blocked (overallStatus ignored)", () => {
    // PRODUCT_WITH_ALL_FILLED: Dev=blocked/mine — worstOwnStatus = blocked
    const { container } = render(
      <SdlcPipeline products={[PRODUCT_WITH_ALL_FILLED]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
  });

  it("stripe is on-track color when worst own stage is on-track (not empty)", () => {
    // PRODUCT_WITH_UNFILLED_OWN_STAGE: Design=empty/mine, Dev=on-track/mine
    // worstOwnStatus = on-track
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
  });

  it("stripe is neutral/empty color when lead has no own stages", () => {
    const noOwnStages: Product = {
      ...BASE_PRODUCT,
      overallStatus: "blocked",
      stages: [
        {
          stageName: "Design",
          status: "blocked",
          ownership: "locked",
          assignee: null,
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline products={[noOwnStages]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain("var(--color-border)");
  });
});

// The left edge is now ALWAYS solid — the completeness dash moved to a
// separate right-side affordance (see the dedicated block below).
describe("SdlcPipeline — left edge is always solid", () => {
  it("never dashes the left edge even with an unfilled own stage", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    expect(getFirstCardStyle(container)).toContain("solid");
    expect(getFirstCardStyle(container)).not.toContain("dashed");
  });
});

// ---- Completeness affordance (right side) ----

function getCompletenessPill(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-complete]");
}

describe("SdlcPipeline — completeness affordance (right side)", () => {
  it("shows an N/M counter pill over the lead's own stages", () => {
    // PRODUCT_WITH_UNFILLED_OWN_STAGE: Design=empty/mine, Dev=on-track/mine → 1/2
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.textContent).toContain("1/2 Your stages");
  });

  it("wraps the pill in a dashed ring while own input is incomplete", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.dataset.complete).toBe("false");
    expect(pill?.getAttribute("style")).toContain("dashed");
  });

  it("removes the dashed ring when own input is complete", () => {
    const { container } = render(
      <SdlcPipeline products={[PRODUCT_WITH_ALL_FILLED]} readOnly={false} />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.dataset.complete).toBe("true");
    expect(pill?.getAttribute("style")).not.toContain("dashed");
  });

  it("hides the completeness affordance in readOnly mode", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={true}
      />,
    );
    expect(getCompletenessPill(container)).toBeNull();
  });

  it("counts only the lead's own stages, ignoring unowned ones", () => {
    // PRODUCT_UNFILLED_BUT_NOT_MINE: Design=empty/unassigned, Dev=on-track/mine
    // → only Dev counts → 1/1, complete.
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_UNFILLED_BUT_NOT_MINE]}
        readOnly={false}
      />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.textContent).toContain("1/1 Your stages");
    expect(pill?.dataset.complete).toBe("true");
  });

  it("W11: an empty own stage covered by the lead's OWN risk COUNTS toward completeness", () => {
    // fix-report-surface-integrity W11 (reverses the old lead-pipeline-card
    // invariant): a stage the lead deliberately staged a risk on is addressed,
    // so the raw `coveredByOwnRisk` flag counts it even while raw status stays
    // "empty". Design=empty BUT coveredByOwnRisk → 2/2, complete. The flag lives
    // on the RAW product (mapper/bridge derive it from persisted own risks), so
    // it survives reload — no transient display state.
    const rawWithOwnCover: Product = {
      ...PRODUCT_WITH_UNFILLED_OWN_STAGE,
      stages: [
        {
          stageName: "Design",
          status: "empty",
          ownership: "mine",
          assignee: "me",
          coveredByOwnRisk: true,
        },
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[rawWithOwnCover]}
        rawProducts={[rawWithOwnCover]}
        readOnly={false}
      />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.textContent).toContain("2/2 Your stages");
    expect(pill?.dataset.complete).toBe("true");
  });

  it("W11: a display-only floored empty stage (no OWN-risk flag) still does NOT count", () => {
    // The render-time floor on `products` (a foreign risk, or any display floor)
    // pushes Design to at-risk for the chip, but the RAW product carries no
    // coveredByOwnRisk flag → completeness reads 1/2, incomplete. This is the
    // "foreign risks color but never count" guard — flooring alone never inflates.
    const flooredDisplay: Product = {
      ...PRODUCT_WITH_UNFILLED_OWN_STAGE,
      stages: [
        {
          stageName: "Design",
          status: "at-risk",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[flooredDisplay]}
        rawProducts={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.textContent).toContain("1/2 Your stages");
    expect(pill?.dataset.complete).toBe("false");
  });
});

// ---- Health vs completeness are INDEPENDENT (all four quadrants) ----

const RED_HEALTH_COMPLETE: Product = {
  ...BASE_PRODUCT,
  stages: [
    {
      stageName: "Design",
      status: "on-track",
      ownership: "mine",
      assignee: "me",
    },
    { stageName: "Dev", status: "blocked", ownership: "mine", assignee: "me" },
  ],
};

const GREEN_HEALTH_INCOMPLETE: Product = {
  ...BASE_PRODUCT,
  stages: [
    { stageName: "Design", status: "empty", ownership: "mine", assignee: "me" },
    {
      stageName: "Dev",
      status: "on-track",
      ownership: "mine",
      assignee: "me",
    },
  ],
};

const GREEN_HEALTH_COMPLETE: Product = {
  ...BASE_PRODUCT,
  stages: [
    {
      stageName: "Design",
      status: "on-track",
      ownership: "mine",
      assignee: "me",
    },
    {
      stageName: "Dev",
      status: "on-track",
      ownership: "mine",
      assignee: "me",
    },
  ],
};

const RED_HEALTH_INCOMPLETE: Product = {
  ...BASE_PRODUCT,
  stages: [
    { stageName: "Design", status: "empty", ownership: "mine", assignee: "me" },
    { stageName: "Dev", status: "blocked", ownership: "mine", assignee: "me" },
  ],
};

describe("SdlcPipeline — health and completeness are independent", () => {
  it("red health + complete input: blocked edge, no dashed ring", () => {
    const { container } = render(
      <SdlcPipeline products={[RED_HEALTH_COMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
    expect(getCompletenessPill(container)?.dataset.complete).toBe("true");
  });

  it("green health + incomplete input: on-track edge, dashed ring", () => {
    const { container } = render(
      <SdlcPipeline products={[GREEN_HEALTH_INCOMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
    expect(getCompletenessPill(container)?.dataset.complete).toBe("false");
  });

  it("green health + complete input", () => {
    const { container } = render(
      <SdlcPipeline products={[GREEN_HEALTH_COMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
    expect(getCompletenessPill(container)?.dataset.complete).toBe("true");
  });

  it("red health + incomplete input", () => {
    const { container } = render(
      <SdlcPipeline products={[RED_HEALTH_INCOMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
    expect(getCompletenessPill(container)?.dataset.complete).toBe("false");
  });
});

// ---- 2.1: foreign stage-owner risk lights the left edge ----

describe("SdlcPipeline — left edge reflects any stage owner's risk", () => {
  it("a cross-author blocked stage recolors the left edge even when own stages are on-track", () => {
    const { container } = render(
      <SdlcPipeline
        products={[GREEN_HEALTH_COMPLETE]}
        readOnly={false}
        crossAuthors={[
          {
            projectId: GREEN_HEALTH_COMPLETE.id,
            projectName: GREEN_HEALTH_COMPLETE.name,
            authorId: "a2",
            authorInitials: "OL",
            stageNames: ["Testing"],
            stages: [{ stageName: "Testing", status: "red" }],
          },
        ]}
      />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
  });

  it("a cross-author on-track stage does not recolor an on-track own edge", () => {
    const { container } = render(
      <SdlcPipeline
        products={[GREEN_HEALTH_COMPLETE]}
        readOnly={false}
        crossAuthors={[
          {
            projectId: GREEN_HEALTH_COMPLETE.id,
            projectName: GREEN_HEALTH_COMPLETE.name,
            authorId: "a2",
            authorInitials: "OL",
            stageNames: ["Testing"],
            stages: [{ stageName: "Testing", status: "green" }],
          },
        ]}
      />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
  });
});

// ---- Task 4.3: co-lead blocked stage — initials chip, no counts ----
//
// A locked stage produced by applyCrossAuthorStageOverrides carries:
//   ownership: "locked", assignee: "<initials>", status: (risk-derived)
// It must render with the initials as the visible assignee label and
// MUST NOT render any item/risk count text (those fields were removed from
// the CrossAuthorRow shape entirely).

describe("SdlcPipeline — 4.3 co-lead blocked locked chip: initials, no counts", () => {
  // Product with one own stage and one locked (co-lead) stage that is blocked.
  const PRODUCT_WITH_LOCKED_BLOCKED: Product = {
    id: "p-colead",
    name: "Shared Product",
    overallStatus: "blocked",
    stages: [
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "Me",
      },
      {
        stageName: "Testing",
        status: "blocked",
        ownership: "locked",
        assignee: "AK",
      },
    ],
  };

  it("co-lead blocked stage colours the product health blocked", () => {
    // Foreign health reaches the card via the `crossAuthors` prop (the server
    // folds covering risks into ca.stages[].status), NOT via the locked entry
    // in product.stages — worstOwnStatus counts only ownership:"mine" stages.
    // This mirrors the real wiring: the same crossAuthorsQ source feeds both the
    // locked-chip override and the crossAuthors prop.
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_LOCKED_BLOCKED]}
        readOnly={false}
        crossAuthors={[
          {
            projectId: PRODUCT_WITH_LOCKED_BLOCKED.id,
            projectName: PRODUCT_WITH_LOCKED_BLOCKED.name,
            authorId: "a2",
            authorInitials: "AK",
            stageNames: ["Testing"],
            stages: [{ stageName: "Testing", status: "red" }],
          },
        ]}
      />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
  });

  it("locked chip label shows initials, not a full name", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_LOCKED_BLOCKED]}
        readOnly={false}
      />,
    );
    // The assignee span renders below the chip button; it must contain
    // the initials string set by applyCrossAuthorStageOverrides.
    const allSpans = Array.from(container.querySelectorAll("span"));
    const assigneeSpan = allSpans.find((s) => s.textContent === "AK");
    expect(assigneeSpan).toBeDefined();
  });

  it("locked chip does not render any item or risk count text", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_LOCKED_BLOCKED]}
        readOnly={false}
      />,
    );
    // Count patterns ("N items", "N risks") must not appear — these fields
    // were removed from CrossAuthorRow; the chip is identity-only.
    expect(container.textContent).not.toContain("items");
    expect(container.textContent).not.toContain("risks");
  });

  it("locked chip is not editable (no status popover on click)", () => {
    render(
      <SdlcPipeline
        products={[PRODUCT_WITH_LOCKED_BLOCKED]}
        readOnly={false}
      />,
    );
    // The Testing chip is locked; clicking it must not open a status menu.
    const lockedBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Testing: blocked"]',
    );
    expect(lockedBtn).toBeDefined();
    lockedBtn?.click();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});

// ---- align-pipeline-arrows: structural contract (D1 + D2) ----
// jsdom has no layout engine; these tests pin the structural contract only:
// - stages row is top-aligned (items-start)
// - each [arrow, chip] cell is top-aligned (items-start)
// - arrow wrapper carries STAGE_CHIP_BOX_HEIGHT as inline height

import { STAGE_CHIP_BOX_HEIGHT } from "./stage-chip-config";

/**
 * Locate the stages row: the flex-wrap div that also carries justify-center
 * (distinct from the product header which uses justify-between).
 */
function getStagesRow(container: HTMLElement): HTMLElement | null {
  const card = container.querySelector(".rounded-xl");
  if (!card) return null;
  return (
    (Array.from(card.querySelectorAll(".flex-wrap")).find((el) =>
      (el as HTMLElement).className.includes("justify-center"),
    ) as HTMLElement | undefined) ?? null
  );
}

describe("SdlcPipeline — align-pipeline-arrows structural contract", () => {
  it("stages row carries items-start (D2)", () => {
    const { container } = render(
      <SdlcPipeline products={[BASE_PRODUCT]} readOnly={false} />,
    );
    const row = getStagesRow(container);
    expect(row).not.toBeNull();
    expect(row?.className).toContain("items-start");
    expect(row?.className).not.toContain("items-center");
  });

  it("each [arrow, chip] cell carries items-start (D2)", () => {
    const { container } = render(
      <SdlcPipeline products={[BASE_PRODUCT]} readOnly={false} />,
    );
    const row = getStagesRow(container);
    expect(row).not.toBeNull();
    if (!row) return;
    const cells = Array.from(row.children) as HTMLElement[];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.className).toContain("items-start");
      expect(cell.className).not.toContain("items-center");
    }
  });

  it("arrow wrapper carries STAGE_CHIP_BOX_HEIGHT as inline height (D1)", () => {
    // BASE_PRODUCT has 2 stages → 1 arrow (idx > 0)
    const { container } = render(
      <SdlcPipeline products={[BASE_PRODUCT]} readOnly={false} />,
    );
    const row = getStagesRow(container);
    expect(row).not.toBeNull();
    if (!row) return;
    const cells = Array.from(row.children) as HTMLElement[];
    // Cell at index 1 (second stage) has the arrow as its first child.
    // Arrow wrapper: direct child that is NOT the StageChip root (min-w-[90px]).
    const secondCell = cells[1] as HTMLElement | undefined;
    expect(secondCell).toBeDefined();
    if (!secondCell) return;
    const arrowEl = Array.from(secondCell.children).find(
      (c) => !(c as HTMLElement).className.includes("min-w-"),
    ) as HTMLElement | undefined;
    expect(arrowEl).toBeDefined();
    if (!arrowEl) return;
    expect(arrowEl.style.height).toBe(STAGE_CHIP_BOX_HEIGHT);
  });
});

// ---- lead-mine-hide-unowned-stages: Mine renders only own stages ----
//
// In Mine mode the pipeline renders ONLY the lead's own stage chips; foreign-
// owned (locked) and vacant (unassigned) chips are hidden, not greyed. Everyone
// renders the full grid. Hiding chips MUST NOT move product health (left edge)
// or own-input completeness, which read the full `product`/`rawProduct`.

/** The stage names of every rendered chip (chips are buttons with aria-label). */
function renderedStageNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("button[aria-label]")).map(
    (b) => (b.getAttribute("aria-label") ?? "").split(":")[0]?.trim() ?? "",
  );
}

describe("SdlcPipeline — lead-mine-hide-unowned-stages chip visibility", () => {
  // One own stage + one foreign-owned (locked) + one vacant (unassigned).
  const PRODUCT_OWN_FOREIGN_VACANT: Product = {
    id: "p-vis",
    name: "Visibility Product",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "me",
      },
      {
        stageName: "Testing",
        status: "at-risk",
        ownership: "locked",
        assignee: "OL",
      },
      {
        stageName: "DevOps",
        status: "empty",
        ownership: "unassigned",
        assignee: null,
      },
    ],
  };

  it("Mine renders only the lead's own chips (foreign + vacant hidden)", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    expect(renderedStageNames(container)).toEqual(["Dev"]);
  });

  it("Everyone renders own + foreign-owned + vacant chips", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="everyone"
      />,
    );
    expect(renderedStageNames(container).sort()).toEqual([
      "Dev",
      "DevOps",
      "Testing",
    ]);
  });

  it("defaults to the full grid when visibilityMode is omitted", () => {
    const { container } = render(
      <SdlcPipeline products={[PRODUCT_OWN_FOREIGN_VACANT]} readOnly={false} />,
    );
    expect(renderedStageNames(container)).toHaveLength(3);
  });

  // ---- reveal-on-hover: collapsed-stage indicator (Mine only) ----

  const COLLAPSED_INDICATOR = '[data-testid="collapsed-stages-indicator"]';

  it("Mine shows a collapsed-stage indicator revealing the hidden stages' names and statuses", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    const indicator = container.querySelector(COLLAPSED_INDICATOR);
    expect(indicator).not.toBeNull();
    // #89: the indicator stays inert — role="img", never a keyboard tab stop.
    expect(indicator?.getAttribute("role")).toBe("img");
    expect(indicator?.getAttribute("tabindex")).toBeNull();
    // Visible count of collapsed stages (Testing + DevOps hidden).
    expect(indicator?.textContent).toContain("2");
    // pipeline-tooltip-and-indicator: the aria-label lists each hidden stage with
    // an honest owner line — an owned-but-unstatused stage names its owner, a
    // vacant stage reads "unassigned" (never "empty" for an owned stage).
    const reveal = "Testing — OL: at-risk, DevOps — unassigned";
    expect(indicator?.getAttribute("title")).toBeNull();
    expect(indicator?.getAttribute("aria-label")).toContain(reveal);
    // It must NOT re-render the hidden chips inline.
    expect(renderedStageNames(container)).toEqual(["Dev"]);
  });

  it("#89: hovering +N more reveals the hidden stages through the shared Radix tooltip", async () => {
    render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    // No tooltip until hover.
    expect(screen.queryByRole("tooltip")).toBeNull();
    const indicator = screen.getByTestId("collapsed-stages-indicator");
    // The indicator is inert (not a keyboard tab stop), so the Radix tooltip
    // opens on pointer hover rather than focus.
    fireEvent.pointerEnter(indicator);
    fireEvent.pointerMove(indicator);
    const tip = await screen.findByRole("tooltip");
    // One honest line per hidden stage — owned-but-unstatused names its owner,
    // a vacant stage reads "unassigned" — revealed via the shared Radix tooltip.
    expect(tip).toHaveTextContent("Testing — OL: at-risk");
    expect(tip).toHaveTextContent("DevOps — unassigned");
  });

  it("pipeline-tooltip-and-indicator: each reveal row carries its stage status colour", async () => {
    // PRODUCT_OWN_FOREIGN_VACANT hides Testing (OL: at-risk) + DevOps
    // (unassigned/empty). Each reveal row MUST take its own status text token —
    // at-risk for Testing, neutral for the unassigned DevOps — not plain text.
    render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    const indicator = screen.getByTestId("collapsed-stages-indicator");
    fireEvent.pointerEnter(indicator);
    fireEvent.pointerMove(indicator);
    const tip = await screen.findByRole("tooltip");
    const atRiskRow = within(tip).getByText(/Testing — OL: at-risk/);
    expect(atRiskRow).toHaveStyle({ color: "var(--color-chip-at-risk-text)" });
    const neutralRow = within(tip).getByText(/DevOps — unassigned/);
    expect(neutralRow).toHaveStyle({ color: "var(--color-muted-foreground)" });
  });

  it("the +N more reveal uses the softer light popover surface, not the dark default", async () => {
    render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    const indicator = screen.getByTestId("collapsed-stages-indicator");
    fireEvent.pointerEnter(indicator);
    fireEvent.pointerMove(indicator);
    await screen.findByRole("tooltip");
    const content = document.querySelector('[data-slot="tooltip-content"]');
    expect(content).not.toBeNull();
    // Scoped restyle: light popover tokens, NOT the shared dark surface.
    expect(content?.classList.contains("bg-popover")).toBe(true);
    expect(content?.classList.contains("bg-foreground")).toBe(false);
  });

  it("#90: the +N more indicator takes the worst hidden status colour (at-risk)", () => {
    // PRODUCT_OWN_FOREIGN_VACANT hides Testing(at-risk) + DevOps(empty);
    // worst = at-risk → the indicator border + text use the at-risk tokens.
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    const indicator = container.querySelector<HTMLElement>(COLLAPSED_INDICATOR);
    expect(indicator?.style.borderColor).toBe(
      "var(--color-chip-at-risk-border)",
    );
    expect(indicator?.style.color).toBe("var(--color-chip-at-risk-text)");
    // #90 MUST NOT: the indicator colour does not bleed into product health.
    // Own Dev is on-track and there is no foreign severity, so the left stripe
    // stays on-track even though the indicator went at-risk.
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
  });

  it("#90 (cross-author): a hidden foreign blocked stage colours the indicator red", () => {
    // The live Mine-mode shape (the one the suite previously never exercised):
    // the foreign DevOps stage is unassigned/empty in the lead's OWN grid, and
    // its real blocked severity arrives only via crossAuthors. The indicator
    // colour must follow that resolved severity, not the local "empty" (grey).
    const product: Product = {
      id: "p-foreign-blocked",
      name: "Foreign Blocked",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "DevOps",
          status: "empty",
          ownership: "unassigned",
          assignee: null,
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[product]}
        readOnly={false}
        visibilityMode="mine"
        crossAuthors={[
          {
            projectId: product.id,
            projectName: product.name,
            authorId: "a-ig",
            authorInitials: "IG",
            stageNames: ["DevOps"],
            stages: [{ stageName: "DevOps", status: "red" }],
          },
        ]}
      />,
    );
    const indicator = container.querySelector<HTMLElement>(COLLAPSED_INDICATOR);
    expect(indicator?.style.borderColor).toBe(
      "var(--color-chip-blocked-border)",
    );
    expect(indicator?.style.color).toBe("var(--color-chip-blocked-text)");
  });

  it("an unfilled hidden stage keeps the indicator grey (full scale)", () => {
    // Own Dev (mine) + a hidden on-track stage + a hidden vacant (empty) stage.
    // No blocked/at-risk, but one stage is unfilled → grey ("not all filled").
    const partlyFilled: Product = {
      id: "p-partly-filled",
      name: "Partly Filled",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "Testing",
          status: "on-track",
          ownership: "locked",
          assignee: "OL",
        },
        {
          stageName: "DevOps",
          status: "empty",
          ownership: "unassigned",
          assignee: null,
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[partlyFilled]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    const indicator = container.querySelector<HTMLElement>(COLLAPSED_INDICATOR);
    expect(indicator?.style.borderColor).toBe("rgba(0, 0, 0, 0.15)");
    expect(indicator?.style.color).toBe("var(--color-muted-foreground)");
  });

  it("an all-on-track hidden set turns the indicator green (full scale)", () => {
    // Every hidden stage is on-track → green, so the lead can trace a healthy
    // collapsed set (reverses the old "neutral unless blocked/at-risk").
    const allOnTrackHidden: Product = {
      id: "p-green-hidden",
      name: "Green Hidden",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "Testing",
          status: "on-track",
          ownership: "locked",
          assignee: "OL",
        },
        {
          stageName: "DevOps",
          status: "on-track",
          ownership: "locked",
          assignee: "IG",
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[allOnTrackHidden]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    const indicator = container.querySelector<HTMLElement>(COLLAPSED_INDICATOR);
    expect(indicator?.style.borderColor).toBe(
      "var(--color-chip-on-track-border)",
    );
    expect(indicator?.style.color).toBe("var(--color-chip-on-track-text)");
  });

  it("reveals a co-owner's initials for a hidden foreign stage, not 'unassigned'", () => {
    // Regression: in Mine mode the lead's own grid marks every non-own stage
    // "unassigned"; the real owner lives in crossAuthors. The +N more reveal
    // must consult it — a DevOps stage held by IG reads as "IG", and only the
    // genuinely-vacant Support reads "unassigned" (the user reported the tooltip
    // showing every hidden stage as empty/unassigned while co-owners held them).
    const product: Product = {
      id: "p-foreign-owned",
      name: "Foreign Owned",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        // Grid marks these unassigned in Mine mode — ownership truth is in crossAuthors.
        {
          stageName: "DevOps",
          status: "empty",
          ownership: "unassigned",
          assignee: null,
        },
        {
          stageName: "Support",
          status: "empty",
          ownership: "unassigned",
          assignee: null,
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[product]}
        readOnly={false}
        visibilityMode="mine"
        crossAuthors={[
          {
            projectId: product.id,
            projectName: product.name,
            authorId: "a-ig",
            authorInitials: "IG",
            stageNames: ["DevOps"],
            stages: [{ stageName: "DevOps", status: "green" }],
          },
        ]}
      />,
    );
    const indicator = container.querySelector(COLLAPSED_INDICATOR);
    const label = indicator?.getAttribute("aria-label") ?? "";
    expect(label).toContain("DevOps — IG: on-track");
    expect(label).toContain("Support — unassigned");
    expect(label).not.toContain("DevOps — unassigned");
  });

  it("Everyone never shows the collapsed-stage indicator (full grid already)", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_OWN_FOREIGN_VACANT]}
        readOnly={false}
        visibilityMode="everyone"
      />,
    );
    expect(container.querySelector(COLLAPSED_INDICATOR)).toBeNull();
  });

  it("a product where the lead owns every stage shows no indicator in Mine", () => {
    const allMine: Product = {
      id: "p-allmine",
      name: "All Mine",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "Testing",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[allMine]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    expect(container.querySelector(COLLAPSED_INDICATOR)).toBeNull();
  });

  it("a product with no own stages in Mine shows the note, not an empty grid", () => {
    const noOwn: Product = {
      id: "p-noown",
      name: "No Own Stages",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Testing",
          status: "at-risk",
          ownership: "locked",
          assignee: "OL",
        },
        {
          stageName: "DevOps",
          status: "empty",
          ownership: "unassigned",
          assignee: null,
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[noOwn]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    expect(renderedStageNames(container)).toEqual([]);
    expect(container.textContent).toContain("No stages assigned to you");
    // The card itself still renders (health left edge present).
    expect(container.querySelector(".rounded-xl")).not.toBeNull();
  });

  it("health stays honest in Mine when the only blocked signal is a hidden foreign chip", () => {
    // Own Dev is on-track; the ONLY blocked severity comes from a foreign
    // (non-own) stage carried via crossAuthors. In Mine that foreign chip is
    // hidden, yet the left edge MUST still read blocked — health derives from
    // crossAuthors + own stages, never from which chips render. A regression
    // that computed health from the visible chips would turn this on-track.
    const ownOnTrack: Product = {
      id: "p-honest",
      name: "Honest Health",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "DevOps",
          status: "empty",
          ownership: "unassigned",
          assignee: null,
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[ownOnTrack]}
        readOnly={false}
        visibilityMode="mine"
        crossAuthors={[
          {
            projectId: ownOnTrack.id,
            projectName: ownOnTrack.name,
            authorId: "a2",
            authorInitials: "IG",
            stageNames: ["DevOps"],
            stages: [{ stageName: "DevOps", status: "red" }],
          },
        ]}
      />,
    );
    // The foreign DevOps chip is hidden in Mine...
    expect(renderedStageNames(container)).toEqual(["Dev"]);
    // ...but the left edge still carries the blocked health hue.
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
  });

  it("completeness counter is unchanged by Mine hiding non-own chips", () => {
    // Own input: Dev filled, Design empty → 1/2. Hiding the foreign/vacant
    // chips in Mine must not change the counter (it reads the full rawProduct).
    const mixed: Product = {
      id: "p-complete",
      name: "Completeness Product",
      overallStatus: "on-track",
      stages: [
        {
          stageName: "Design",
          status: "empty",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
        {
          stageName: "Testing",
          status: "at-risk",
          ownership: "locked",
          assignee: "OL",
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline
        products={[mixed]}
        readOnly={false}
        visibilityMode="mine"
      />,
    );
    expect(container.textContent).toContain("1/2 Your stages");
  });
});
