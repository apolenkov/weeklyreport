/**
 * @vitest-environment jsdom
 *
 * rethink-pipeline-state-vs-completeness: the left edge carries ONLY product
 * health (always solid). Own-input completeness is a SEPARATE right-side
 * affordance (dashed ring + "N/M stages" counter) and never shares the health
 * hue. Tests prove the two signals are independent across all four quadrants.
 */

import { render } from "@testing-library/react";
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
    expect(pill?.textContent).toContain("1/2 stages");
  });

  it("wraps the pill in a dashed ring while own input is incomplete", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.getAttribute("data-complete")).toBe("false");
    expect(pill?.getAttribute("style")).toContain("dashed");
  });

  it("removes the dashed ring when own input is complete", () => {
    const { container } = render(
      <SdlcPipeline products={[PRODUCT_WITH_ALL_FILLED]} readOnly={false} />,
    );
    const pill = getCompletenessPill(container);
    expect(pill?.getAttribute("data-complete")).toBe("true");
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
    expect(pill?.textContent).toContain("1/1 stages");
    expect(pill?.getAttribute("data-complete")).toBe("true");
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
    expect(getCompletenessPill(container)?.getAttribute("data-complete")).toBe(
      "true",
    );
  });

  it("green health + incomplete input: on-track edge, dashed ring", () => {
    const { container } = render(
      <SdlcPipeline products={[GREEN_HEALTH_INCOMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
    expect(getCompletenessPill(container)?.getAttribute("data-complete")).toBe(
      "false",
    );
  });

  it("green health + complete input", () => {
    const { container } = render(
      <SdlcPipeline products={[GREEN_HEALTH_COMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
    expect(getCompletenessPill(container)?.getAttribute("data-complete")).toBe(
      "true",
    );
  });

  it("red health + incomplete input", () => {
    const { container } = render(
      <SdlcPipeline products={[RED_HEALTH_INCOMPLETE]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
    expect(getCompletenessPill(container)?.getAttribute("data-complete")).toBe(
      "false",
    );
  });
});

// ---- 2.1: foreign stage-owner risk lights the left edge ----

describe("SdlcPipeline — left edge reflects any stage owner's risk", () => {
  it("a cross-author blocker recolors the left edge even when own stages are on-track", () => {
    const { container } = render(
      <SdlcPipeline
        products={[GREEN_HEALTH_COMPLETE]}
        readOnly={false}
        crossAuthors={[
          {
            projectId: GREEN_HEALTH_COMPLETE.id,
            projectName: GREEN_HEALTH_COMPLETE.name,
            authorId: "a2",
            authorName: "Other Lead",
            stageNames: ["Testing"],
            itemCount: 0,
            riskCount: 1,
            risks: [{ severity: "blocked", text: "infra down" }],
            isEmpty: false,
          },
        ]}
      />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-blocked-border)",
    );
  });

  it("does not recolor while a cross-author entry is still loading (risks=null)", () => {
    const { container } = render(
      <SdlcPipeline
        products={[GREEN_HEALTH_COMPLETE]}
        readOnly={false}
        crossAuthors={[
          {
            projectId: GREEN_HEALTH_COMPLETE.id,
            projectName: GREEN_HEALTH_COMPLETE.name,
            authorId: "a2",
            authorName: "Other Lead",
            stageNames: ["Testing"],
            itemCount: 0,
            riskCount: 1,
            risks: null,
            isEmpty: false,
          },
        ]}
      />,
    );
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
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
