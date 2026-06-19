import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocumentActionGroup, ReportToolbar } from "./report-toolbar";

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

  it("keeps the bordered frame and stays horizontally reachable at narrow widths", () => {
    render(<ReportToolbar contextControls={<span>Ctx</span>} />);
    const contextBar = screen.getByRole("group", { name: "Context controls" });
    expect(contextBar.dataset.testid).toBe("report-toolbar");
    expect(contextBar.className).toContain("rounded-");
    expect(contextBar.className).toContain("overflow-x-auto");
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
        <button type="button">Submit Section</button>
      </DocumentActionGroup>,
    );
    const group = screen.getByRole("group", { name: "Document actions" });
    expect(group).toContainElement(
      screen.getByRole("button", { name: "Submit Section" }),
    );
    // Header line wraps so no document action is clipped (no overflow clip).
    expect(group.className).toContain("flex-wrap");
  });
});
