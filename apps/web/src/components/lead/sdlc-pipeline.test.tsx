/**
 * @vitest-environment jsdom
 *
 * D5: dashed left-stripe when the lead has at least one own stage unfilled.
 * Tests cover getProductCardStyle directly and a component-level assertion
 * that the rendered card style attribute reflects the dashed/solid state.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Product } from "./mock-data";
import { getProductCardStyle, SdlcPipeline } from "./sdlc-pipeline";

// ---- Unit: getProductCardStyle ----

describe("getProductCardStyle — D5 dashed stripe", () => {
  it("returns dashed borderLeft when dashed=true", () => {
    const style = getProductCardStyle("on-track", true);
    expect(style.borderLeft).toContain("dashed");
  });

  it("returns solid borderLeft when dashed=false", () => {
    const style = getProductCardStyle("on-track", false);
    expect(style.borderLeft).toContain("solid");
  });

  it("does not change the color token between dashed and solid for on-track", () => {
    const dashed = getProductCardStyle("on-track", true);
    const solid = getProductCardStyle("on-track", false);
    const colorToken = "var(--color-chip-on-track-border)";
    expect(dashed.borderLeft).toContain(colorToken);
    expect(solid.borderLeft).toContain(colorToken);
  });

  it("does not change the color token between dashed and solid for blocked", () => {
    const dashed = getProductCardStyle("blocked", true);
    const solid = getProductCardStyle("blocked", false);
    const colorToken = "var(--color-chip-blocked-border)";
    expect(dashed.borderLeft).toContain(colorToken);
    expect(solid.borderLeft).toContain(colorToken);
  });

  it("does not change the color token between dashed and solid for empty", () => {
    const dashed = getProductCardStyle("empty", true);
    const solid = getProductCardStyle("empty", false);
    const colorToken = "var(--color-border)";
    expect(dashed.borderLeft).toContain(colorToken);
    expect(solid.borderLeft).toContain(colorToken);
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

describe("SdlcPipeline — D5 dashed stripe (component)", () => {
  it("renders dashed stripe when edit view has an unfilled own stage", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={false}
      />,
    );
    expect(getFirstCardStyle(container)).toContain("dashed");
  });

  it("renders solid stripe when all own stages are filled", () => {
    const { container } = render(
      <SdlcPipeline products={[PRODUCT_WITH_ALL_FILLED]} readOnly={false} />,
    );
    expect(getFirstCardStyle(container)).toContain("solid");
    expect(getFirstCardStyle(container)).not.toContain("dashed");
  });

  it("renders solid stripe in readOnly mode even when own stage is empty", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_WITH_UNFILLED_OWN_STAGE]}
        readOnly={true}
      />,
    );
    expect(getFirstCardStyle(container)).toContain("solid");
    expect(getFirstCardStyle(container)).not.toContain("dashed");
  });

  it("renders solid stripe when unfilled stage is not owned by this lead", () => {
    const { container } = render(
      <SdlcPipeline
        products={[PRODUCT_UNFILLED_BUT_NOT_MINE]}
        readOnly={false}
      />,
    );
    expect(getFirstCardStyle(container)).toContain("solid");
    expect(getFirstCardStyle(container)).not.toContain("dashed");
  });
});
