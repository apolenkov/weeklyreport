import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";

// CSS layout, not end padding, must reserve a row at every scroll position.
const css = readFileSync("src/styles/app.css", "utf8");

describe("completion rail layout", () => {
  it("reserves a content scrollport and an intrinsic action row", () => {
    expect(css).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(css).toContain('[data-testid="lead-completion-scrollport"]');
    expect(css).toContain("overflow-y: auto");
  });

  it("keeps the rail in normal layout instead of painting a fixed overlay", () => {
    render(
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
          submitDisabled: false,
        }}
      />,
    );
    expect(
      screen.getByTestId("lead-sticky-completion-actions").className,
    ).not.toMatch(/\bfixed\b/u);
  });
});
