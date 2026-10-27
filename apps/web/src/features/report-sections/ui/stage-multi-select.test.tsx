// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StageMultiSelect } from "./stage-multi-select";

describe("StageMultiSelect", () => {
  it("keeps labelled stage checkboxes keyboard-operable with 44px targets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev", "Testing", "Release"]}
        stages={["Dev", "Testing", "Release"]}
        onChange={onChange}
      />,
    );

    // Each selected stage appears exactly once (in the checkbox label — not duplicated as pills).
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every((cb) => (cb as HTMLInputElement).checked)).toBe(
      true,
    );

    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    const chipLabel = checkboxes[0]?.closest("label");
    expect(chipLabel?.className).toContain("min-h-[var(--touch-target-min)]");
    expect(chipLabel?.className).not.toContain("md:min-h-[34px]");

    const devCheckbox = screen.getByRole("checkbox", { name: "Dev" });
    devCheckbox.focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(["Testing", "Release"]);

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

  it("does not create a scope banner when no stage is selected", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={[]}
        stages={["Dev", "Testing", "Release"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
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

  it("renders the selected-stage banner with one assigned stage", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev"]}
        stages={["Dev"]}
        onChange={vi.fn()}
        previewSeverity="blocked"
      />,
    );
    expect(screen.getByTestId("stage-scope-banner")).toBeInTheDocument();
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

// A saved item, decision or risk can name a stage the lead no longer owns — an
// admin may reassign the product stage after the record was written. No
// checkbox can represent it, but the saved name stays visible as a removable
// chip so the lead is not trapped; the server remains the ownership authority,
// so an untouched saved name still travels in the onChange payload.
describe("StageMultiSelect — saved stages outside the available list", () => {
  const removeLegacyChip = () =>
    screen.getByRole("button", {
      name: "Remove Legacy — no longer assigned",
    });

  it("ignores an unavailable saved stage in the severity preview", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Legacy"]}
        stages={["Dev", "Testing"]}
        onChange={vi.fn()}
        previewSeverity="at-risk"
      />,
    );

    expect(screen.queryByTestId("stage-scope-banner")).toBeNull();
  });

  it("shows a saved stage outside the available list as a removable chip", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Testing", "Legacy"]}
        stages={["Dev", "Testing"]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Legacy — no longer assigned")).toBeInTheDocument();
    expect(removeLegacyChip()).toBeInTheDocument();
    // The unavailable name is never a selectable checkbox.
    expect(screen.queryByRole("checkbox", { name: "Legacy" })).toBeNull();
  });

  it("removes only the leftover stage from the payload", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StageMultiSelect
        id="stages"
        value={["Testing", "Legacy"]}
        stages={["Dev", "Testing"]}
        onChange={onChange}
      />,
    );

    await user.click(removeLegacyChip());

    expect(onChange).toHaveBeenCalledWith(["Testing"]);
  });

  it("keeps an untouched saved stage when an available stage is checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StageMultiSelect
        id="stages"
        value={["Testing", "Legacy"]}
        stages={["Dev", "Testing"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Dev" }));

    expect(onChange).toHaveBeenCalledWith(["Testing", "Legacy", "Dev"]);
  });

  it("keeps an untouched saved stage when an available stage is unchecked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev", "Testing", "Legacy"]}
        stages={["Dev", "Testing"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Testing" }));

    expect(onChange).toHaveBeenCalledWith(["Dev", "Legacy"]);
  });

  it("keeps the leftover chip keyboard-removable when no stages are available", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StageMultiSelect
        id="stages"
        value={["Legacy"]}
        stages={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("Legacy — no longer assigned")).toBeInTheDocument();
    expect(
      screen.getByText("No assigned stages available."),
    ).toBeInTheDocument();

    removeLegacyChip().focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renders no leftover chip when every saved stage is available", () => {
    render(
      <StageMultiSelect
        id="stages"
        value={["Dev"]}
        stages={["Dev", "Testing"]}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /no longer assigned/ }),
    ).toBeNull();
  });
});
