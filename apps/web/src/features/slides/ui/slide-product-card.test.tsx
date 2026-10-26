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

  // A role="img" mark with aria-label already owns the accessible name; a
  // second hidden copy of the same label is a mechanism AT can read twice.
  it.each(STATUS_CASES)(
    "names the $label mark once, without a hidden duplicate",
    ({ status, label }) => {
      render(
        <SlideProductCard
          card={productCard(status, "Core Product")}
          authorsById={authorsById}
        />,
      );

      const mark = screen.getByRole("img", { name: label });
      expect(mark).toHaveAttribute("aria-label", label);
      expect(mark.textContent).toBe("");
      expect(screen.queryByText(label)).toBeNull();
    },
  );

  it("collapses a product whose only activity has no status or records, and omits empty Shared", () => {
    const grid = buildSlideGridModel({
      section: makeReportSectionFixture({
        projects: [
          { projectId: "p1", projectName: "Alpha", trafficLight: null },
        ],
        activities: [
          {
            activityId: "linked",
            activityName: "Linked empty",
            status: null,
            derivedStatus: null,
            linkedProducts: [{ productId: "p1", productName: "Alpha" }],
          },
          {
            activityId: "shared",
            activityName: "Shared empty",
            status: null,
            derivedStatus: null,
            linkedProducts: [],
          },
        ],
      }),
    });
    expect(grid.products.map(({ id }) => id)).toEqual(["p1"]);
    const card = expectDefined(grid.products[0]);
    render(<SlideProductCard card={card} authorsById={authorsById} />);
    expect(screen.getByTestId("slide-product-empty")).toHaveTextContent(
      "Alpha",
    );
    expect(screen.getByText("no status for this period")).toBeInTheDocument();
    expect(screen.queryByText("Linked empty")).not.toBeInTheDocument();
  });

  it.each([
    { status: "yellow" as const, derivedStatus: null, withRecord: false },
    { status: null, derivedStatus: "yellow" as const, withRecord: false },
    { status: null, derivedStatus: null, withRecord: true },
  ])(
    "retains activity status or records: $status/$derivedStatus/$withRecord",
    ({ status, derivedStatus, withRecord }) => {
      const grid = buildSlideGridModel({
        section: makeReportSectionFixture({
          projects: [
            { projectId: "p1", projectName: "Alpha", trafficLight: null },
          ],
          activities: [
            {
              activityId: "activity-1",
              activityName: "Operations",
              status,
              derivedStatus,
              linkedProducts: [{ productId: "p1", productName: "Alpha" }],
            },
          ],
          items: withRecord
            ? [
                {
                  projectId: null,
                  activityId: "activity-1",
                  type: "current",
                  text: "Activity update",
                  tag: "",
                  carriedOver: false,
                  workflowStatus: "in_progress",
                },
              ]
            : [],
        }),
      });
      const card = expectDefined(grid.products[0]);
      render(<SlideProductCard card={card} authorsById={authorsById} />);
      expect(screen.getByTestId("slide-product-card")).toBeInTheDocument();
      expect(screen.getByText("Operations")).toBeInTheDocument();
      expect(
        screen.queryByText("no status for this period"),
      ).not.toBeInTheDocument();
      if (withRecord)
        expect(screen.getByText("Activity update")).toBeInTheDocument();
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

    // The status label is the mark's accessible name only: no visible status
    // word sits beside the product name.
    expect(screen.getByRole("img", { name: "On Track" })).toBeInTheDocument();
    expect(screen.queryByText("On Track")).toBeNull();
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

  it("renders the effective Activity title and description together", () => {
    const grid = buildSlideGridModel({
      section: makeReportSectionFixture({
        projects: [
          { projectId: "p1", projectName: "Alpha", trafficLight: "green" },
        ],
        activities: [
          {
            activityId: "activity-1",
            activityName: "Operations",
            titleOverride: "Weekly operations",
            note: "Coverage remains staffed",
            status: "green",
            linkedProducts: [{ productId: "p1", productName: "Alpha" }],
          },
        ],
      }),
    });
    const card = expectDefined(
      grid.products.find((product) => product.id === "p1"),
    );
    render(<SlideProductCard card={card} authorsById={authorsById} />);
    expect(screen.getByText("Weekly operations")).toBeInTheDocument();
    expect(screen.getByText("Coverage remains staffed")).toBeInTheDocument();
  });
  it("collapses an empty cell to one labelled dash line on phones", () => {
    const card: GridProductCard = {
      id: "p1",
      name: "Alpha",
      status: "green",
      noData: false,
      subsections: [
        {
          kind: "product-level",
          id: "p1-product",
          name: "Product-level",
          note: null,
          linkedProducts: [],
          status: null,
          showStages: false,
          columns: {
            current: [
              {
                id: "row-1",
                text: "Shipped the release",
                authorId: "a1",
                tone: "neutral",
                hoverLabel: "Shipped the release",
                stageNames: [],
              },
            ],
            next: [],
            risks: [],
            decisions: [],
          },
        },
      ],
    };
    render(<SlideProductCard card={card} authorsById={authorsById} />);

    const risks = screen.getByRole("heading", { name: "Risks" });
    expect(risks).toHaveClass("max-sm:hidden");
    const empty = screen.getByLabelText("No Risks");
    expect(empty).toHaveTextContent("—");
    expect(empty).toHaveTextContent("No risks");
    const current = screen.getByRole("heading", { name: "Current work" });
    expect(current).not.toHaveClass("max-sm:hidden");
  });
});
