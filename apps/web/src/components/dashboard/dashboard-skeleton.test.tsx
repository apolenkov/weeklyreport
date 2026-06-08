/**
 * Regression tests for DashboardSkeleton (verify-a11y-recommended-flip catalog).
 * In-scope rows: thead placeholder skeleton array map (snapshot/high),
 * thead placeholder column headers structure (unit-rtl/high),
 * DashboardSkeleton full render (snapshot/medium).
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardSkeleton } from "./dashboard-skeleton";

describe("DashboardSkeleton", () => {
  it("renders 5 thead placeholder skeletons with the correct arbitrary-width classes", () => {
    const { container } = render(<DashboardSkeleton />);

    // The column-header row is the only flex gap-4 div without items-center.
    // Its children carry w-[Npx] arbitrary-value classes.
    const skeletons = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="skeleton"]'),
    ).filter((el) => /w-\[\d+px\]/.test(el.className));

    expect(skeletons).toHaveLength(5);

    const widths = skeletons.map((el) => {
      const match = /w-\[(\d+px)\]/.exec(el.className);
      return match ? match[1] : null;
    });
    expect(widths).toEqual(["120px", "80px", "80px", "80px", "100px"]);
  });

  it("matches thead placeholder skeleton snapshot", () => {
    const { container } = render(<DashboardSkeleton />);

    // Scope to the thead placeholder block: the first flex gap-4 div (no
    // items-center) whose children all carry w-[Npx] arbitrary widths.
    const allFlexGap4 = Array.from(
      container.querySelectorAll<HTMLElement>("div.flex.gap-4"),
    );
    const theadDiv = allFlexGap4.find((el) =>
      Array.from(el.children).every((child) =>
        /w-\[\d+px\]/.test((child as HTMLElement).className),
      ),
    );

    expect(theadDiv).toBeDefined();
    expect(theadDiv).toMatchSnapshot();
  });

  it("matches full DashboardSkeleton render snapshot", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
