/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StageStep } from "./stage-step";

const BASE_PROPS = {
  id: "record-stage",
  stageIds: ["Testing"],
  availableStages: ["Development", "Testing"] as const,
  isDeadEnd: false,
  error: undefined,
  onChange: vi.fn(),
  deadEndNotice: "No stages assigned — contact admin.",
};

describe("StageStep", () => {
  it("renders the required stage multi-select with the given props", () => {
    const onChange = vi.fn();
    render(<StageStep {...BASE_PROPS} onChange={onChange} />);

    expect(screen.getByText(/^Required\. Select at least one/)).toHaveAttribute(
      "id",
      "record-stage-hint",
    );
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Development" }));
    expect(onChange).toHaveBeenCalledWith(["Testing", "Development"]);
  });

  it("shows the caller-supplied dead-end notice exactly when dead-ended", () => {
    const { rerender } = render(<StageStep {...BASE_PROPS} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<StageStep {...BASE_PROPS} isDeadEnd />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No stages assigned — contact admin.",
    );
  });

  it("suppresses the required-stage error in the dead-end branch", () => {
    render(
      <StageStep
        {...BASE_PROPS}
        isDeadEnd
        error="Select at least one stage."
      />,
    );

    expect(
      screen.queryByText("Select at least one stage."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("forwards preview severity to the stage multi-select", () => {
    render(<StageStep {...BASE_PROPS} previewSeverity="at-risk" />);

    expect(screen.getByTestId("stage-scope-banner")).toHaveTextContent(
      "Stage Testing will show as At Risk.",
    );
  });
});
