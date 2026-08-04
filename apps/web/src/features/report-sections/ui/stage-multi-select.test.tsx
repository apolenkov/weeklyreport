// @vitest-environment jsdom
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
    expect(checkboxes.every((cb) => (cb as HTMLInputElement).checked)).toBe(
      true,
    );

    // Touch-target floor below md; jsdom cannot eval media queries — class is the teeth.
    const chipLabel = checkboxes[0]?.closest("label");
    expect(chipLabel?.className).toContain("min-h-[var(--touch-target-min)]");
    expect(chipLabel?.className).toContain("md:min-h-[34px]");

    // No duplicate "Scope:" summary when stages are selected.
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

  it("renders preview-warning as a banner ABOVE the checkbox group", () => {
    const { container } = render(
      <StageMultiSelect
        id="stages"
        value={["Dev"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );

    const banner = screen.getByTestId("stage-scope-banner");
    const checkboxGroup = container.querySelector(
      '[data-testid="stage-checkbox-group"]',
    );
    expect(banner).toBeInTheDocument();
    expect(checkboxGroup).toBeInTheDocument();
    expect(
      banner.compareDocumentPosition(checkboxGroup as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("banner is an aria-live alert with role='status'", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    const banner = screen.getByTestId("stage-scope-banner");
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });

  it("text says 'All assigned stages…' when nothing is selected", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={[]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    expect(
      screen.getByText(/All assigned stages will show as Blocked\.?/i),
    ).toBeInTheDocument();
  });

  it("text names the single selected stage when exactly one is chosen", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Testing"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="at-risk"
      />,
    );
    expect(
      screen.getByText(/Stage Testing will show as At Risk\.?/i),
    ).toBeInTheDocument();
  });

  it("text drops enumeration when more than one stage is selected", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev", "Testing"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    expect(
      screen.getByText(/Selected stages will show as Blocked\.?/i),
    ).toBeInTheDocument();
    // The comma-separated list must NOT appear.
    expect(screen.queryByText(/Dev, Testing/)).toBeNull();
  });

  it("does NOT render the banner when only one assigned stage exists (singleStage branch)", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev"]}
        stages={["Dev"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
  });

  it("does NOT render the banner when stages list is empty", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={[]}
        stages={[]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
  });
});

// Required mode: empty selection is invalid, so suppress the "all stages" banner.
describe("StageMultiSelect — required-mode banner honesty", () => {
  it("suppresses the empty-selection banner when required is true", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={[]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
        required
      />,
    );

    expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
    expect(screen.queryByText(/All assigned stages will show as/i)).toBeNull();
  });

  it("still renders the empty-selection banner in non-required mode", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={[]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );

    expect(
      screen.getByText(/All assigned stages will show as Blocked\.?/i),
    ).toBeInTheDocument();
  });

  it("renders the per-stage banner in required mode once a stage is selected", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Testing"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="at-risk"
        required
      />,
    );

    expect(
      screen.getByText(/Stage Testing will show as At Risk\.?/i),
    ).toBeInTheDocument();
  });
});
