import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadCompletionLayout } from "./lead-completion-layout";
import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";

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
