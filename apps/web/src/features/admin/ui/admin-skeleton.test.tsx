import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminTabSkeleton } from "./admin-skeleton";

describe("AdminTabSkeleton responsive surface", () => {
  it("keeps the wide loading grid inside a local scroll owner", () => {
    render(<AdminTabSkeleton variant="table" />);

    const grid = screen.getByTestId("skeleton-table-grid");
    expect(grid).toHaveClass("overflow-x-auto");
    expect(grid.firstElementChild).toHaveClass("min-w-[36rem]");
  });
});
