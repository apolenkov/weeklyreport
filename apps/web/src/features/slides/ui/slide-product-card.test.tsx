import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GridAuthor } from "../model/slide-grid-model";
import type { GridProductCard } from "../model/slide-grid-products";
import { SlideProductCard } from "./slide-article-grid";

const authorsById = new Map<string, GridAuthor>();

const STATUS_CASES = [
  {
    status: "green",
    label: "On Track",
    iconClass: "lucide-circle-check",
    stripe: "border-l-[var(--color-chip-on-track-border)]",
  },
  {
    status: "yellow",
    label: "At Risk",
    iconClass: "lucide-triangle-alert",
    stripe: "border-l-[var(--color-status-dot-at-risk)]",
  },
  {
    status: "red",
    label: "Blocked",
    iconClass: "lucide-octagon-x",
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
  it.each(STATUS_CASES)(
    "exposes $label with its distinct icon and retained stripe",
    ({ status, label, iconClass, stripe }) => {
      const name = "Core Product";
      render(
        <SlideProductCard
          card={productCard(status, name)}
          authorsById={authorsById}
        />,
      );

      const mark = screen.getByRole("img", { name: label });
      expect(mark.querySelector("svg")).toHaveClass(iconClass);
      expect(mark).toHaveClass("h-4", "w-4", "shrink-0");
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
