import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordVisibilityToggle } from "./record-visibility-toggle";

describe("RecordVisibilityToggle — responsive touch-target geometry", () => {
  it("floors both mobile segments without changing the compact desktop contract", () => {
    render(<RecordVisibilityToggle value="mine" onChange={vi.fn()} />);

    const buttons = [
      screen.getByRole("button", { name: "Mine only" }),
      screen.getByRole("button", { name: "Everyone" }),
    ];

    // jsdom does not evaluate media queries; responsive utility classes are
    // the regression teeth for the mobile 44px floor.
    for (const button of buttons) {
      expect(button).toHaveClass(
        "max-md:min-h-[var(--touch-target-min)]",
        "max-md:min-w-[var(--touch-target-min)]",
        "h-full",
      );
      expect(button).toHaveClass("w-[calc(var(--toolbar-control-h)-0.25rem)]");
      expect(button).not.toHaveClass("min-h-[var(--touch-target-min)]");
    }

    // The shared toolbar token remains the desktop sizing contract.
    expect(
      screen.getByRole("group", { name: "Record visibility" }),
    ).toHaveClass("h-[var(--toolbar-control-h)]");
  });

  // R08: icon-only segments read as stray filled buttons next to the labelled
  // view-mode toggle; desktopLabels restores text on wide screens.
  it("shows segment labels at lg when desktopLabels is set", () => {
    render(
      <RecordVisibilityToggle value="mine" onChange={vi.fn()} desktopLabels />,
    );

    for (const label of ["Mine only", "Everyone"]) {
      expect(screen.getByText(label)).toHaveClass("lg:not-sr-only");
    }
    expect(screen.getByRole("button", { name: "Mine only" })).toHaveClass(
      "lg:min-w-[68px]",
    );
  });

  it("preserves accessible state and switches to the selected visibility", () => {
    const onChange = vi.fn();
    render(<RecordVisibilityToggle value="mine" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Mine only" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Everyone" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("everyone");
  });
});
