import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadCompletionLayout } from "./lead-completion-layout";
import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";

const appCss = readFileSync(
  resolve(import.meta.dirname, "../../../../../styles/app.css"),
  "utf8",
);

function cssBlockAt(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start === -1) return "";
  return source.slice(start, source.indexOf("}", start) + 1);
}

describe("completion rail layout", () => {
  it("renders actions outside the content scrollport", () => {
    render(
      <LeadCompletionLayout
        actions={<aside aria-label="Completion">Actions</aside>}
      >
        <button>Report content</button>
      </LeadCompletionLayout>,
    );
    const layout = screen.getByTestId("lead-completion-layout");
    const scrollport = screen.getByTestId("lead-completion-scrollport");
    expect(layout).toHaveClass("lead-completion-layout");
    expect(scrollport).toHaveClass("lead-completion-scrollport");
    expect(scrollport).toContainElement(
      screen.getByRole("button", { name: "Report content" }),
    );
    expect(scrollport).not.toContainElement(screen.getByRole("complementary"));
    expect(scrollport.nextElementSibling).toBe(
      screen.getByRole("complementary"),
    );
  });
  // jsdom computes no geometry, so this pins the structure and the stylesheet
  // contract; the browser proof is e2e/lead-form/rail-clearance.test.ts.
  it("keeps the rail a layout row after the scrollport, not a painted overlay", () => {
    render(
      <LeadCompletionLayout
        actions={
          <LeadStickyCompletionActions
            actions={{
              autosave: {
                state: "idle",
                lastSavedAt: null,
                dirty: false,
                currentPayloadMatchesSavedBaseline: true,
                isInFlight: false,
                forceSave: () => Promise.resolve(),
              },
              onSubmit: () => undefined,
              onReviewPending: () => undefined,
              submitDisabled: false,
            }}
          />
        }
      >
        <button>Report content</button>
      </LeadCompletionLayout>,
    );
    const rail = screen.getByRole("complementary", {
      name: "Report completion",
    });
    const layout = screen.getByTestId("lead-completion-layout");
    expect(rail.parentElement).toBe(layout);
    expect(screen.getByTestId("lead-completion-scrollport").nextSibling).toBe(
      rail,
    );
  });

  it("gives the layout two rows and the remaining viewport height", () => {
    const layoutRule = cssBlockAt(appCss, ".lead-completion-layout {");
    expect(layoutRule).toContain("display: grid;");
    expect(layoutRule).toContain("grid-template-rows: minmax(0, 1fr) auto;");
    // A viewport-tall layout under an unpinned nav bar scrolls the document.
    expect(layoutRule).not.toMatch(/(?<![-\w])height:/u);
    const fillRule = cssBlockAt(
      appCss,
      ".app-viewport:has(.lead-completion-layout) .lead-completion-layout {",
    );
    expect(fillRule).toContain("flex: 1 1 0;");
    expect(
      cssBlockAt(appCss, ".app-viewport:has(.lead-completion-layout) {"),
    ).toContain("height: 100dvh;");
  });
});
