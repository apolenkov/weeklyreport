/**
 * a11y: both AccordionSection toggles expose aria-controls pointing at the
 * collapsible panel, and that id resolves to the panel element in the DOM.
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccordionSection } from "./accordion-section";

const HIDDEN_ICON = <span aria-hidden="true" />;

describe("AccordionSection — aria-controls", () => {
  it("both toggles carry aria-controls pointing at the panel id", () => {
    render(
      <AccordionSection
        icon={HIDDEN_ICON}
        title="Risks"
        testId="risks-accordion"
        actions={
          <button type="button" aria-label="Add risk">
            Add
          </button>
        }
      >
        <p>Panel body</p>
      </AccordionSection>,
    );

    // Header toggle (name derived from the title) + trailing icon-button toggle
    // (aria-label) both reference the same panel; defaultOpen renders expanded.
    const headerToggle = screen.getByRole("button", { name: "Risks" });
    const iconToggle = screen.getByRole("button", { name: "Collapse Risks" });

    const panelId = headerToggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(iconToggle).toHaveAttribute("aria-controls", panelId);

    // The id resolves to the actual collapsible panel element.
    if (!panelId) return;
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(screen.getByText("Panel body"));
  });

  it("derives a stable panel id from testId", () => {
    render(
      <AccordionSection
        icon={HIDDEN_ICON}
        title="Decisions"
        testId="decisions-accordion"
      >
        <p>Decisions body</p>
      </AccordionSection>,
    );

    const headerToggle = screen.getByRole("button", { name: "Decisions" });
    expect(headerToggle).toHaveAttribute(
      "aria-controls",
      "decisions-accordion-panel",
    );
  });
});
