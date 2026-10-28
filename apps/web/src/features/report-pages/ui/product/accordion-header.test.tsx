import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WeeklyProductReport } from "../../../report-sections";
import { AccordionHeader } from "./accordion-header";

function makeReport(
  overrides?: Partial<WeeklyProductReport>,
): WeeklyProductReport {
  return {
    id: "prod-1",
    authorIds: ["author-1"],
    initials: "PA",
    name: "Platform Architecture",
    status: "on-track",
    statusLabel: "On track",
    leads: "Lead Engineer",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

describe("AccordionHeader button content phrasing conformance (C5025)", () => {
  it("renders button without any div descendants when hasContent is true", () => {
    const report = makeReport();
    const onToggle = vi.fn();

    render(
      <AccordionHeader
        report={report}
        hasContent={true}
        expanded={false}
        onToggle={onToggle}
        toggleId="test-toggle-id"
        panelId="test-panel-id"
      />,
    );

    const button = screen.getByRole("button", {
      name: /Platform Architecture/i,
    });
    expect(button).toBeDefined();

    // C5025: buttons must only contain phrasing content, zero div descendants
    const divDescendants = button.querySelectorAll("div");
    expect(divDescendants).toHaveLength(0);

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders disabled button without any div descendants when hasContent is false", () => {
    const report = makeReport({ initials: "NP", name: "No Progress" });
    const onToggle = vi.fn();

    render(
      <AccordionHeader
        report={report}
        hasContent={false}
        expanded={false}
        onToggle={onToggle}
        toggleId="test-toggle-empty"
        panelId="test-panel-empty"
      />,
    );

    const button = screen.getByRole("button", {
      name: /No Progress/i,
    });
    expect(button).toBeDefined();
    expect(button).toBeDisabled();

    // C5025: buttons must only contain phrasing content, zero div descendants
    const divDescendants = button.querySelectorAll("div");
    expect(divDescendants).toHaveLength(0);
  });
});
