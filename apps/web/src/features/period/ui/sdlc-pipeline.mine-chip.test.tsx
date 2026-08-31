// @vitest-environment jsdom
//
// Left edge carries ONLY product health (always solid). Own-input completeness
// is a SEPARATE right-side affordance (dashed ring + "N/M stages" counter) and
// never shares the health hue. Tests prove the two signals are independent
// across all four quadrants.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Product } from "../../report-sections";
import { SdlcPipeline } from "./sdlc-pipeline";

// ---- Unit: getProductCardStyle (health-only, always solid) ----

function getFirstCardStyle(container: HTMLElement): string {
  const card = container.querySelector(".rounded-xl");
  return (card as HTMLElement | null)?.getAttribute("style") ?? "";
}

// Mine renders only own stages; foreign-owned (locked) and vacant chips are
// hidden, not greyed. Everyone renders the full grid. Hiding chips MUST NOT
// move product health (left edge) or own-input completeness.

function renderedStageNames(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      '[data-testid="sdlc-stage-row"] button[aria-label]',
    ),
  ).map(
    (b) => (b.getAttribute("aria-label") ?? "").split(":")[0]?.trim() ?? "",
  );
}

describe("SdlcPipeline — Mine chip visibility", () => {
  // Post-mapper grids never carry a vacant "unassigned" stage — a non-owned
  // stage is foreign-owned (locked). Fixture: one own + locked(OL) + locked(null).
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
        ownership: "locked",
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
    // The indicator is read-only, but focusable so its tooltip works on touch
    // and keyboard as well as pointer hover.
    expect(indicator?.tagName).toBe("BUTTON");
    expect(indicator?.getAttribute("type")).toBe("button");
    // Visible count of collapsed stages (Testing + DevOps hidden).
    expect(indicator?.textContent).toContain("2");
    // aria-label lists each hidden stage with an honest owner line — owned
    // stages name their owner; unresolved foreign reads "another lead".
    const reveal = "Testing — OL: at-risk, DevOps — another lead";
    expect(indicator?.getAttribute("title")).toBeNull();
    expect(indicator?.getAttribute("aria-label")).toContain(reveal);
    // It must NOT re-render the hidden chips inline.
    expect(renderedStageNames(container)).toEqual(["Dev"]);
  });

  it("hovering +N more reveals the hidden stages through the shared Radix tooltip", async () => {
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
    // The indicator opens the shared tooltip on pointer hover or focus.
    fireEvent.pointerEnter(indicator);
    fireEvent.pointerMove(indicator);
    const tip = await screen.findByRole("tooltip");
    // One honest line per hidden stage — owned-but-unstatused names its owner,
    // a foreign-owned stage with no resolved owner reads "another lead" —
    // revealed via the shared Radix tooltip.
    expect(tip).toHaveTextContent("Testing — OL: at-risk");
    expect(tip).toHaveTextContent("DevOps — another lead");
  });

  it("each reveal row carries its stage status colour", async () => {
    // PRODUCT_OWN_FOREIGN_VACANT hides Testing (OL: at-risk) + DevOps
    // (foreign-owned, empty). Each reveal row MUST take its own status text
    // token — at-risk for Testing, neutral for the empty DevOps — not plain text.
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
    const neutralRow = within(tip).getByText(/DevOps — another lead/);
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

  it("the +N more indicator takes the worst hidden status colour (at-risk)", () => {
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
    // The indicator colour must not bleed into product health.
    // Own Dev is on-track and there is no foreign severity, so the left stripe
    // stays on-track even though the indicator went at-risk.
    expect(getFirstCardStyle(container)).toContain(
      "var(--color-chip-on-track-border)",
    );
  });

  it("a hidden foreign blocked stage colours the indicator red", () => {
    // In Mine mode the foreign DevOps stage is empty in the lead's own grid, and
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
          ownership: "locked",
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
          ownership: "locked",
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
    expect(indicator?.style.borderColor).toBe("var(--color-border)");
    expect(indicator?.style.color).toBe("var(--color-muted-foreground)");
  });

  it("an all-on-track hidden set turns the indicator green (full scale)", () => {
    // Every hidden stage is on-track → green, so the lead can trace a healthy
    // collapsed set while preserving the healthy product signal.
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

  it("reveals a co-owner's initials for a hidden foreign stage, falling back to 'another lead'", () => {
    // Regression: in Mine mode the lead's own grid carries foreign-owned stages
    // as locked with a null assignee; the real owner lives in crossAuthors. The
    // +N more reveal must consult it — a DevOps stage held by IG reads as "IG",
    // and an unresolved foreign stage (Support) reads "another lead" (the user
    // reported the tooltip showing every hidden stage as empty while co-owners
    // held them). The "unassigned" label is gone.
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
        // Foreign-owned in Mine mode — ownership truth is in crossAuthors.
        {
          stageName: "DevOps",
          status: "empty",
          ownership: "locked",
          assignee: null,
        },
        {
          stageName: "Support",
          status: "empty",
          ownership: "locked",
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
    expect(label).toContain("Support — another lead");
    expect(label).not.toContain("DevOps — another lead");
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
          ownership: "locked",
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
          ownership: "locked",
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
