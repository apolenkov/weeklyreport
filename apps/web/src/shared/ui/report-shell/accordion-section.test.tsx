// Accessibility seam: both toggle variants must point aria-controls at the
// rendered collapsible panel.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccordionSection } from "./accordion-section";

const HIDDEN_ICON = <span aria-hidden="true" />;

describe("AccordionSection — aria-controls", () => {
  it("exposes the disclosure title as a level-two heading", () => {
    render(
      <AccordionSection icon={HIDDEN_ICON} title="Risks">
        <p>Panel body</p>
      </AccordionSection>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Risks" });
    expect(heading).toContainElement(
      screen.getByRole("button", { name: "Risks" }),
    );
  });

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
    expect(panel).toHaveAttribute("role", "region");
    expect(panel).toHaveAttribute("aria-labelledby", `${panelId}-title`);
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
    expect(screen.getByTestId("decisions-accordion")).toHaveAttribute(
      "data-feedback-anchor",
      "decisions-accordion",
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

describe("AccordionSection — open signal", () => {
  it("preserves a collapsed initial state when mounted with a signal", () => {
    render(signalSection("risk:4"));

    expect(screen.getByRole("button", { name: "Risks" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens on every later signal, including after a manual collapse", () => {
    const { rerender } = render(signalSection("risk:4"));
    const toggle = screen.getByRole("button", { name: "Risks" });

    rerender(signalSection("risk:5"));
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(signalSection("risk:6"));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("AccordionSection — responsive disclosure geometry", () => {
  it("moves action controls to a second mobile header row", () => {
    render(
      <AccordionSection
        icon={HIDDEN_ICON}
        title="Risks"
        actions={<button type="button">Add risk</button>}
      >
        <p>Panel body</p>
      </AccordionSection>,
    );

    const headerToggle = screen.getByRole("button", { name: "Risks" });
    const heading = headerToggle.closest("h2");
    expect(heading).toHaveClass("max-sm:basis-full");
    expect(heading?.parentElement).toHaveClass("max-sm:flex-wrap");
    expect(
      screen.getByRole("button", { name: "Add risk" }).parentElement?.className,
    ).toContain("max-sm:ml-auto");
  });

  it("floors the trailing disclosure at the touch target in both states", () => {
    render(
      <AccordionSection
        icon={HIDDEN_ICON}
        title="Risks"
        actions={<span>Actions</span>}
      >
        <p>Panel body</p>
      </AccordionSection>,
    );

    const compactDesktopClasses = ["h-10", "w-10"];
    const mobileTouchTargetClasses = [
      "max-md:min-h-[var(--touch-target-min)]",
      "max-md:min-w-[var(--touch-target-min)]",
    ];
    const disclosure = screen.getByRole("button", {
      name: "Collapse Risks",
    });

    // jsdom does not evaluate media queries; these classes pin the mobile
    // floor while h-10/w-10 preserve the compact desktop geometry.
    expect(disclosure).toHaveClass(
      ...compactDesktopClasses,
      ...mobileTouchTargetClasses,
    );
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(disclosure);

    const collapsedDisclosure = screen.getByRole("button", {
      name: "Expand Risks",
    });
    expect(collapsedDisclosure).toHaveClass(
      ...compactDesktopClasses,
      ...mobileTouchTargetClasses,
    );
    expect(collapsedDisclosure).toHaveAttribute("aria-expanded", "false");
  });
});

describe("AccordionSection — reduced motion and collapsed semantics", () => {
  it("makes collapsed content inert and disables disclosure transitions under reduced motion", () => {
    render(
      <AccordionSection
        icon={HIDDEN_ICON}
        title="Risks"
        defaultOpen={false}
        testId="reduced-motion-accordion"
      >
        <button type="button">Panel action</button>
      </AccordionSection>,
    );

    const panel = document.getElementById("reduced-motion-accordion-panel");
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass("motion-reduce:transition-none");
    expect(panel?.firstElementChild).toHaveAttribute("inert");
    expect(panel?.firstElementChild).toHaveAttribute("aria-hidden", "true");

    const chevron = screen
      .getByRole("button", { name: "Risks" })
      .querySelector("svg");
    expect(chevron).toHaveClass("motion-reduce:transition-none");
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

function signalSection(openSignal: string) {
  return (
    <AccordionSection
      icon={HIDDEN_ICON}
      title="Risks"
      defaultOpen={false}
      openSignal={openSignal}
    >
      <p>Panel body</p>
    </AccordionSection>
  );
}
