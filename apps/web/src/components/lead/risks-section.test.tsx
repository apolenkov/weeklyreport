/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RisksSection } from "./risks-section";
import type { RiskEntry } from "./mock-data";

const baseRisk: RiskEntry = {
  id: "risk-1",
  productId: "product-1",
  productName: "CRM",
  severity: "at-risk",
  text: "Vendor delay",
  impact: "Delivery slips",
  mitigation: "Escalate",
};

describe("RisksSection stage scope", () => {
  it("renders explicit all-stage selection as stage chips, not All stages", () => {
    render(
      <RisksSection
        risks={[{ ...baseRisk, stageIds: ["Dev", "Testing"] }]}
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });

  it("keeps All stages only for omitted stage scope", () => {
    render(<RisksSection risks={[baseRisk]} />);

    expect(screen.getByText("All stages")).toBeInTheDocument();
  });

  it("compacts long explicit stage selections", () => {
    render(
      <RisksSection
        risks={[
          {
            ...baseRisk,
            stageIds: ["Planning", "Analysis", "Design", "Dev"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
