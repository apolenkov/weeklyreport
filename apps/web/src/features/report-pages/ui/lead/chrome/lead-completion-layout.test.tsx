import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadCompletionLayout } from "./lead-completion-layout";

const appCss = readFileSync(
  resolve(import.meta.dirname, "../../../../../styles/app.css"),
  "utf8",
);

function cssBlockAt(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) return "";
  return source.slice(start, source.indexOf("}", start) + 1);
}

describe("completion layout", () => {
  it("renders only the content scrollport, with no completion rail", () => {
    render(
      <LeadCompletionLayout>
        <button>Report content</button>
      </LeadCompletionLayout>,
    );
    const layout = screen.getByTestId("lead-completion-layout");
    const scrollport = screen.getByTestId("lead-completion-scrollport");
    expect(scrollport).toContainElement(
      screen.getByRole("button", { name: "Report content" }),
    );
    expect(layout.children).toHaveLength(1);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("gives the scrollport the one row and the remaining viewport height", () => {
    const layoutRule = cssBlockAt(appCss, ".lead-completion-layout {");
    expect(layoutRule).toContain("display: grid;");
    expect(layoutRule).toContain("grid-template-rows: minmax(0, 1fr);");
    // A viewport-tall layout under an unpinned nav bar scrolls the document.
    expect(layoutRule).not.toMatch(/(?<![-\w])height:/u);
    expect(appCss).not.toContain(".lead-completion-layout > aside");
    const fillRule = cssBlockAt(
      appCss,
      ".app-viewport:has(.lead-completion-layout) .lead-completion-layout {",
    );
    expect(fillRule).toContain("flex: 1 1 0;");
    // Absolute sr-only labels inside rows must be contained by the scrollport.
    expect(cssBlockAt(appCss, ".lead-completion-scrollport {")).toContain(
      "position: relative;",
    );
    expect(
      cssBlockAt(appCss, ".app-viewport:has(.lead-completion-layout) {"),
    ).toContain("height: 100dvh;");
  });

  it("keeps focus clear of the period toolbar and falls back to document flow below 32rem", () => {
    // Callers can override the toolbar offset variable.
    expect(cssBlockAt(appCss, ".lead-completion-scrollport {")).toContain(
      "scroll-padding-block: var(--sticky-toolbar-offset, 5rem) 1rem;",
    );

    const shortViewportRule = cssBlockAt(appCss, "@media (height < 32rem) {");
    expect(shortViewportRule).toContain(".lead-completion-scrollport");
    expect(shortViewportRule).toContain("overflow-y: visible;");
  });
});
