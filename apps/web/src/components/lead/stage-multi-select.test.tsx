/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StageMultiSelect } from "./stage-multi-select";

describe("StageMultiSelect", () => {
  it("shows checkboxes checked for each selected stage, no duplicate scope pills", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev", "Testing", "Release"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
      />,
    );

    // Each selected stage appears exactly once (in the checkbox label — not duplicated as pills).
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(
      checkboxes.every((cb) => (cb as HTMLInputElement).checked),
    ).toBe(true);

    // No "Scope:" duplicate summary — the commit removed it when stages are selected.
    expect(screen.queryByText("Scope:")).not.toBeInTheDocument();
    // No "all assigned stages" footer when at least one stage is selected.
    expect(
      screen.queryByText("Scope: all assigned stages."),
    ).not.toBeInTheDocument();
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
