/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StageMultiSelect } from "./stage-multi-select";

describe("StageMultiSelect", () => {
  it("shows compact overflow with +N more", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev", "Testing", "Release"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.getByText(/Scope: Dev, Testing/i)).toBeInTheDocument();
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
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText("Applied automatically")).toBeInTheDocument();
  });
});
