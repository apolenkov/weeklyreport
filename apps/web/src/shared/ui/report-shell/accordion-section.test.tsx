// Accessibility seam: both toggle variants must point aria-controls at the
// rendered collapsible panel.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
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

describe("AccordionSection — group commands", () => {
  it("expands an individually collapsed section after a full group cycle", () => {
    const { rerender } = renderSection(true);
    const toggle = screen.getByRole("button", { name: "Risks" });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(section(false));
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(section(true));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("honors an individual override until the next group command", () => {
    const { rerender } = renderSection(false);
    const toggle = screen.getByRole("button", { name: "Risks" });

    rerender(section(true));
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(section(false));
    rerender(section(true));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

function section(groupExpanded: boolean) {
  return (
    <AccordionSection
      icon={HIDDEN_ICON}
      title="Risks"
      groupExpanded={groupExpanded}
    >
      <p>Panel body</p>
    </AccordionSection>
  );
}

function renderSection(groupExpanded: boolean) {
  return render(section(groupExpanded));
}
