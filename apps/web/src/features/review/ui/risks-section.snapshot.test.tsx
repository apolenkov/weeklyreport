// @vitest-environment jsdom
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
  stageNames: ["Planning"],
};

describe("RisksSection meta-row", () => {
  it("renders author name in the left slot of the meta-row", () => {
    render(
      <RisksSection risks={[BASE_RISK]} sectionAuthorName="Vasily Lead" />,
    );
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
  });

  it("renders the No-stage-set warning pill when stageNames is absent", () => {
    render(
      <RisksSection
        risks={[{ ...BASE_RISK, stageNames: [] }]}
        sectionAuthorName="Anna"
      />,
    );
    expect(screen.getByText("No stage set")).toBeInTheDocument();
    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Risk stages: No stage set" }),
    ).toBeInTheDocument();
  });

  it("renders specific stage chips and author together in the meta-row", () => {
    render(
      <RisksSection
        risks={[{ ...BASE_RISK, stageNames: ["Development", "Testing"] }]}
        stagesForProduct={() => ["Development", "Testing"]}
        sectionAuthorName="Vasily Lead"
      />,
    );
    expect(screen.getByText("Vasily Lead")).toBeInTheDocument();
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Risk stages: Development, Testing" }),
    ).toBeInTheDocument();
  });
});
