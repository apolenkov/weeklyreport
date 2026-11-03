import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    scroll: _scroll,
    ...props
  }: React.ComponentProps<"a"> & { scroll?: boolean }) => <a {...props} />,
}));

import { ViewModeToggle } from "./view-mode-toggle";

describe("ViewModeToggle", () => {
  it("names the read-only destination Report with its active state and tooltip", () => {
    render(
      <ViewModeToggle
        editHref="/report"
        slidesHref="/slides"
        readOnly
        desktopLabels
      />,
    );
    const report = screen.getByRole("link", { name: "Report" });
    expect(report).toHaveAttribute("title", "Report");
    expect(report).toHaveAttribute("aria-current", "page");
    expect(report).toHaveAttribute("href", "/report");
    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "title",
      "Slides",
    );
  });

  it("preserves authoring defaults", () => {
    render(<ViewModeToggle editHref="/edit" slidesHref="/slides" />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "title",
      "Edit",
    );
  });
});
