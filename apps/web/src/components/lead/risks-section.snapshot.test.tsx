/**
 * @vitest-environment jsdom
 *
 * Pre-extract snapshot: MetaRow [author | stage chips] in RisksSection.
 * Baseline before Wave 1 A2 extracts this markup to report-shell/meta-row.tsx.
 * After extraction, these tests must pass without changes.
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

describe("RisksSection meta-row — pre-extract snapshot", () => {
  it("renders author name in the left slot of the meta-row", () => {
    render(<RisksSection risks={[BASE_RISK]} sectionAuthorName="Vasily Lead" />);
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
  });

  it("renders All-stages pill when stageIds is absent", () => {
    const { container } = render(
      <RisksSection risks={[BASE_RISK]} sectionAuthorName="Anna" />,
    );
    expect(screen.getByText("All stages")).toBeInTheDocument();
    const stageDiv = container.querySelector('[aria-label="Risk stages: all stages"]');
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
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    const stageDiv = container.querySelector('[aria-label^="Risk stages:"]');
    expect(stageDiv).toMatchSnapshot();
  });
});
