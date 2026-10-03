import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DocumentActionGroup,
  ReportToolbar,
  ReportToolbarCenterLabel,
} from "./report-toolbar";

describe("ReportToolbar", () => {
  it("renders the context controls in a single labeled bar", () => {
    render(
      <ReportToolbar contextControls={<button type="button">Edit</button>} />,
    );
    const contextBar = screen.getByRole("group", { name: "Context controls" });
    expect(contextBar).toContainElement(
      screen.getByRole("button", { name: "Edit" }),
    );
    // report-toolbar-layout: document actions no longer live in the bordered
    // toolbar — they render on the page header line via DocumentActionGroup.
    expect(
      screen.queryByRole("group", { name: "Document actions" }),
    ).toBeNull();
  });

  it("returns nothing when no context controls are passed", () => {
    const { container } = render(<ReportToolbar />);
    expect(container.firstChild).toBeNull();
  });

  it("keeps the bordered frame and wraps controls at narrow widths", () => {
    render(<ReportToolbar contextControls={<span>Ctx</span>} />);
    const contextBar = screen.getByRole("group", { name: "Context controls" });
    expect(contextBar.dataset.testid).toBe("report-toolbar");
    expect(contextBar.className).toContain("rounded-");
    expect(contextBar.className).toContain("flex-wrap");
    expect(contextBar.className).not.toContain("overflow-x-auto");
  });

  it("default render is non-sticky (no sticky positioning class)", () => {
    render(<ReportToolbar contextControls={<span>Ctx</span>} />);
    const contextBar = screen.getByRole("group", { name: "Context controls" });
    expect(contextBar.className).not.toContain("sticky");
    // Resting frame keeps the translucent surface; no opaque/elevated bits.
    expect(contextBar.className).toContain(
      "bg-[var(--color-surface-hover)]/70",
    );
    expect(contextBar.className).not.toContain("shadow-md");
  });

  it("sticky variant pins to the top with an opaque, elevated surface", () => {
    render(<ReportToolbar sticky contextControls={<span>Ctx</span>} />);
    const contextBar = screen.getByRole("group", { name: "Context controls" });
    // Pinned positioning + a z-index below the NavBar dropdown layer (z-30).
    expect(contextBar.className).toContain("sticky");
    expect(contextBar.className).toContain("md:sticky");
    expect(contextBar.className).toContain("md:top-0");
    expect(contextBar.className).toContain("md:z-20");
    expect(contextBar.className).toContain("top-0");
    expect(contextBar.className).toContain("z-20");
    // Opaque background (no /70) so scrolling content cannot bleed through,
    // plus a shadow elevation cue.
    expect(contextBar.className).toContain("bg-[var(--color-surface-hover)]");
    expect(contextBar.className).not.toContain(
      "bg-[var(--color-surface-hover)]/70",
    );
    expect(contextBar.className).toContain("shadow-md");
  });
});

describe("DocumentActionGroup", () => {
  it("wraps document actions in a labeled group that wraps at narrow widths", () => {
    render(
      <DocumentActionGroup>
        <button type="button">Submit</button>
      </DocumentActionGroup>,
    );
    const group = screen.getByRole("group", { name: "Document actions" });
    expect(group).toContainElement(
      screen.getByRole("button", { name: "Submit" }),
    );
    // Header line wraps so no document action is clipped (no overflow clip).
    expect(group.className).toContain("flex-wrap");
  });

  it("publishes the measured sticky height as the scroll offset and clears it on unmount", () => {
    let notify: () => void = () => undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe = () => undefined;
        disconnect = () => undefined;
      },
    );
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(50);
    const root = document.documentElement;
    const { unmount } = render(
      <ReportToolbar sticky contextControls={<span>Ctx</span>} />,
    );
    expect(root.style.getPropertyValue("--sticky-toolbar-offset")).toBe("66px");
    height.mockReturnValue(90);
    notify();
    expect(root.style.getPropertyValue("--sticky-toolbar-offset")).toBe(
      "106px",
    );
    unmount();
    expect(root.style.getPropertyValue("--sticky-toolbar-offset")).toBe("");
    height.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe("ReportToolbarCenterLabel (R19)", () => {
  it("stacks label and detail below md and shows the separator only inline", () => {
    const { container } = render(
      <ReportToolbarCenterLabel label="Department" detail="Live review" />,
    );
    expect(container.firstElementChild).toHaveClass("flex-col", "md:flex-row");
    const separator = screen.getByText("\u00B7");
    expect(separator).toHaveClass("hidden", "md:inline");
    expect(separator).toHaveAttribute("aria-hidden", "true");
  });
});
