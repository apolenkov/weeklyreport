import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import {
  buildSlideGridModel,
  type GridAuthor,
} from "../model/slide-grid-model";
import type { GridProductCard } from "../model/slide-grid-products";
import { SlideProductCard } from "./slide-article-grid";

const authorsById = new Map<string, GridAuthor>();

const STATUS_CASES = [
  {
    status: "green",
    label: "On Track",
    stripe: "border-l-[var(--color-chip-on-track-border)]",
  },
  {
    status: "yellow",
    label: "At Risk",
    stripe: "border-l-[var(--color-status-dot-at-risk)]",
  },
  {
    status: "red",
    label: "Blocked",
    stripe: "border-l-[var(--color-destructive)]",
  },
] as const;

function productCard(
  status: GridProductCard["status"],
  name: string,
): GridProductCard {
  return {
    id: name,
    name,
    status,
    noData: false,
    subsections: [],
  };
}

describe("SlideProductCard status presentation", () => {
  it.each([
    { linkedProducts: [], label: null },
    {
      linkedProducts: [{ productId: "p1", productName: "Alpha" }],
      label: "Linked products: Alpha",
    },
    {
      linkedProducts: [
        { productId: "p1", productName: "Alpha" },
        { productId: "p2", productName: "Beta" },
      ],
      label: "Linked products: Alpha, Beta",
    },
  ])(
    "retains Activity product labels on its Product or Shared card: $label",
    ({ linkedProducts, label }) => {
      const grid = buildSlideGridModel({
        section: makeReportSectionFixture({
          projects: [
            { projectId: "p1", projectName: "Alpha", trafficLight: "green" },
            { projectId: "p2", projectName: "Beta", trafficLight: "green" },
          ],
          activities: [
            {
              activityId: "activity-1",
              activityName: "Operations",
              status: "green",
              linkedProducts,
            },
          ],
        }),
      });
      const card = expectDefined(
        grid.products.find((product) =>
          product.subsections.some(
            (subsection) => subsection.id === "activity-1",
          ),
        ),
      );
      render(<SlideProductCard card={card} authorsById={authorsById} />);
      expect(screen.getByText("Operations")).toBeInTheDocument();
      expect(card.id).toBe(
        linkedProducts.length === 1 ? "p1" : "cross-product",
      );
      if (label) expect(screen.getByText(label)).toBeInTheDocument();
      else
        expect(screen.queryByText(/Linked products:/)).not.toBeInTheDocument();
    },
  );

  it.each(STATUS_CASES)(
    "exposes $label as the accessible mark and names the card with it",
    ({ status, label, stripe }) => {
      const name = "Core Product";
      render(
        <SlideProductCard
          card={productCard(status, name)}
          authorsById={authorsById}
        />,
      );

      expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
      expect(screen.getByRole("heading")).toHaveAccessibleName(
        `${label} ${name}`,
      );
      expect(screen.getByTestId("slide-product-card")).toHaveClass(stripe);
    },
  );

  it("keeps the compact label hidden and preserves the full product title", () => {
    const name = "Customer Insights and Reporting Platform";
    render(
      <SlideProductCard
        card={productCard("green", name)}
        authorsById={authorsById}
      />,
    );

    expect(screen.getByText("On Track")).toHaveClass("sr-only");
    const title = screen.getByTitle(name);
    expect(title).toHaveTextContent(name);
    expect(title).not.toHaveClass("truncate");
  });

  it("keeps the no-status product collapsed without an icon or stripe", () => {
    render(
      <SlideProductCard
        card={{ ...productCard(null, "Data Portal"), noData: true }}
        authorsById={authorsById}
      />,
    );

    const row = screen.getByTestId("slide-product-empty");
    expect(row).toHaveTextContent("Data Portal");
    expect(row).toHaveTextContent("no status for this period");
    expect(row).not.toHaveClass("border-l-4");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("slide-product-card")).not.toBeInTheDocument();
  });
});
