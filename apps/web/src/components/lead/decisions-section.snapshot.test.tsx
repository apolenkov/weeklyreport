/**
 * @vitest-environment jsdom
 *
 * Pre-extract snapshot: MetaRow [author | stage chips] in DecisionsSection.
 * Baseline before Wave 1 A2 extracts this markup to report-shell/meta-row.tsx.
 * After extraction, these tests must pass without changes.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionsSection } from "./decisions-section";

const BASE_DECISION = {
  id: "d1",
  productId: "p1",
  productName: "CRM",
  text: "Adopt new framework",
  owner: "Vasily Lead",
  impact: "Faster delivery",
  deadline: null,
};

describe("DecisionsSection meta-row — pre-extract snapshot", () => {
  it("renders decision owner in the left slot of the meta-row", () => {
    render(<DecisionsSection decisions={[BASE_DECISION]} readOnly />);
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
  });

  it("renders All-stages pill when stageIds is absent", () => {
    const { container } = render(
      <DecisionsSection decisions={[BASE_DECISION]} readOnly />,
    );
    expect(screen.getByText("All stages")).toBeInTheDocument();
    const row = container.querySelector('[aria-label^="Decision stages:"]');
    expect(row).toMatchSnapshot();
  });

  it("renders specific stage chips alongside the owner in the meta-row", () => {
    const { container } = render(
      <DecisionsSection
        decisions={[{ ...BASE_DECISION, stageIds: ["Analysis", "Dev"] }]}
        availableStages={["Analysis", "Dev"]}
        readOnly
      />,
    );
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Dev")).toBeInTheDocument();
    const row = container.querySelector('[aria-label^="Decision stages:"]');
    expect(row).toMatchSnapshot();
  });
});
