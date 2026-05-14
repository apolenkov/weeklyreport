import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrioritiesSection } from "./priorities-section";
import type { PriorityEntry } from "./mock-data";

describe("PrioritiesSection", () => {
  it("D-16: collapses long stage scopes into two chips plus an overflow badge", () => {
    const priorities: PriorityEntry[] = [
      {
        rank: 1,
        text: "Ship reporting API hardening",
        productName: "CRM",
        stageIds: ["Planning", "DevOps", "Release"],
      },
    ];

    render(
      <PrioritiesSection
        priorities={priorities}
        readOnly={true}
        onChange={vi.fn()}
        availableStages={["Planning", "DevOps", "Release"]}
      />,
    );

    expect(screen.getByLabelText("Stage Planning")).toHaveTextContent("PLA");
    expect(screen.getByLabelText("Stage DevOps")).toHaveTextContent("DO");
    expect(screen.getByText("+1")).toBeVisible();
    expect(
      screen.getByLabelText("Priority 1 stages: Planning, DevOps, Release"),
    ).toBeVisible();
    expect(screen.queryByLabelText("Stage Release")).not.toBeInTheDocument();
  });

  it("D-16: keeps all-stage priorities explicit", () => {
    render(
      <PrioritiesSection
        priorities={[{ rank: 1, text: "Coordinate release readiness" }]}
        readOnly={true}
      />,
    );

    expect(screen.getByText("All stages")).toBeVisible();
    expect(
      screen.getByLabelText("Priority 1 stages: all stages"),
    ).toBeVisible();
  });
});
