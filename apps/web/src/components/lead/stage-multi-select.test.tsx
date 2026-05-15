/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StageMultiSelect } from "./stage-multi-select";

describe("StageMultiSelect", () => {
  it("shows every selected stage in the scope summary", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev", "Testing", "Release"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Scope:")).toBeInTheDocument();
    expect(screen.getAllByText("Dev").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Testing").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Release").length).toBeGreaterThan(1);
    expect(screen.queryByText("+1 more")).not.toBeInTheDocument();
  });

  it("hides the picker when only one assigned stage exists", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev"]}
        stages={["Dev"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByText("Dev").length).toBeGreaterThan(0);
    expect(screen.getByText("Applied automatically")).toBeInTheDocument();
  });
});
