// @vitest-environment jsdom
//
// Left edge carries ONLY product health (always solid). Own-input completeness
// is a SEPARATE right-side affordance (dashed ring + "N/M stages" counter) and
// never shares the health hue. Tests prove the two signals are independent
// across all four quadrants.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Product } from "../../report-sections";
import { getProductCardStyle, SdlcPipeline } from "./sdlc-pipeline";

// ---- Unit: getProductCardStyle (health-only, always solid) ----

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
      ownership: "locked",
      assignee: null,
    },
    { stageName: "Dev", status: "on-track", ownership: "mine", assignee: "me" },
  ],
};

function getFirstCardStyle(container: HTMLElement): string {
  const card = container.querySelector(".rounded-xl");
  return (card as HTMLElement | null)?.getAttribute("style") ?? "";
}

function getCompletenessPill(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-complete]");
}

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

// ---- Live stripe color from own stages ----

describe("SdlcPipeline — live stripe color from own stages", () => {
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

// The left edge is ALWAYS solid — the completeness dash lives in a
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
    // PRODUCT_UNFILLED_BUT_NOT_MINE: Design=empty/locked (foreign), Dev=on-track/mine
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

  it("an empty own stage covered by the lead's OWN risk COUNTS toward completeness", () => {
    // A stage the lead deliberately staged a risk on is addressed,
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

  it("a display-only floored empty stage (no OWN-risk flag) still does NOT count", () => {
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

// ---- Foreign stage-owner risk lights the left edge ----

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

// ---- Co-lead blocked stage — initials chip, no counts ----
//
// A locked stage produced by applyCrossAuthorStageOverrides carries:
//   ownership: "locked", assignee: "<initials>", status: (risk-derived)
// It must render with the initials as the visible assignee label and
// MUST NOT render any item/risk count text (those fields were removed from
// the CrossAuthorRow shape entirely).

describe("SdlcPipeline — co-lead blocked locked chip: initials, no counts", () => {
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
    expect(lockedBtn).toBeInstanceOf(HTMLElement);
    lockedBtn?.click();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});

// ---- Pipeline stage-row structural contract ----
// jsdom has no layout engine; these tests pin the structural contract only:
// every visible stage has its own full-width row and the row keeps one
// semantic status control with an explicit visual status marker.
function getStageRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="sdlc-stage-row"]'),
  );
}

describe("SdlcPipeline — pipeline stage-row structural contract", () => {
  it("renders one full-width row per visible stage", () => {
    const { container } = render(
      <SdlcPipeline products={[BASE_PRODUCT]} readOnly={false} />,
    );
    const rows = getStageRows(container);
    expect(rows).toHaveLength(BASE_PRODUCT.stages.length);
    for (const row of rows) {
      expect(row.className).toContain("w-full");
      expect(row.className).toContain("min-w-0");
      expect(row.querySelector("button")).toBeInTheDocument();
    }
  });

  it("preserves canonical stage order and renders a status glyph in each row", () => {
    const { container } = render(
      <SdlcPipeline products={[BASE_PRODUCT]} readOnly={false} />,
    );
    const rows = getStageRows(container);
    const buttons = rows.map((row) => row.querySelector("button"));
    expect(buttons.map((button) => button?.textContent)).toEqual([
      expect.stringContaining("Design"),
      expect.stringContaining("Dev"),
    ]);
    expect(
      container.querySelectorAll('[data-testid="stage-status-glyph"]'),
    ).toHaveLength(BASE_PRODUCT.stages.length);
    expect(
      container.querySelectorAll(
        '[data-testid="stage-status-glyph"][data-status="on-track"]',
      ),
    ).toHaveLength(BASE_PRODUCT.stages.length);
  });

  it("keeps long labels inside a full-width row", () => {
    const longLabelProduct: Product = {
      ...BASE_PRODUCT,
      stages: [
        {
          stageName: "Development and platform enablement",
          status: "on-track",
          ownership: "mine",
          assignee: "me",
        },
      ],
    };
    const { container } = render(
      <SdlcPipeline products={[longLabelProduct]} readOnly={false} />,
    );
    const row = getStageRows(container)[0];
    expect(row).toBeDefined();
    expect(row?.querySelector("button")?.className).toContain("text-left");
    expect(row?.querySelector("button span span")?.className).toContain(
      "truncate",
    );
  });
});
