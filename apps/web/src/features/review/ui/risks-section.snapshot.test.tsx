/**
 * @vitest-environment jsdom
 *
 * Characterizes the MetaRow [author | stage chips] markup rendered by
 * RisksSection (via RiskCard), independent of where that markup lives —
 * these assertions must keep passing across internal refactors of either
 * component.
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RisksSection } from "./risks-section";

const BASE_RISK = {
  id: "r1",
  productId: "p1",
  productName: "CRM",
  severity: "at-risk" as const,
  text: "Vendor delay",
  impact: "Delivery slips",
  mitigation: "Escalate",
};

describe("RisksSection meta-row", () => {
  it("renders author name in the left slot of the meta-row", () => {
    render(
      <RisksSection risks={[BASE_RISK]} sectionAuthorName="Vasily Lead" />,
    );
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
  });

  it("renders the No-stage-set warning pill when stageIds is absent", () => {
    const { container } = render(
      <RisksSection risks={[BASE_RISK]} sectionAuthorName="Anna" />,
    );
    expect(screen.getByText("No stage set")).toBeInTheDocument();
    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    const stageDiv = container.querySelector(
      '[aria-label="Risk stages: No stage set"]',
    );
    expect(stageDiv).toMatchSnapshot();
  });

  it("renders specific stage chips and author together in the meta-row", () => {
    const { container } = render(
      <RisksSection
        risks={[{ ...BASE_RISK, stageIds: ["Dev", "Testing"] }]}
        stagesForProduct={() => ["Dev", "Testing"]}
        sectionAuthorName="Vasily Lead"
      />,
    );
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
    // "Dev" is canonicalized to "Development" before rendering.
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    const stageDiv = container.querySelector('[aria-label^="Risk stages:"]');
    expect(stageDiv).toMatchSnapshot();
  });
});
