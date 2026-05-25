/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SdlcTooltipProvider } from "../ui/sdlc-tooltip";
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

const foreignRisk: RiskEntry = {
  id: "r1",
  productId: "p1",
  productName: "Product",
  severity: "at-risk",
  text: "x",
  impact: "i",
  mitigation: "m",
  foreign: true,
  authorName: "Alice",
};

describe("RisksSection LockBadge (Phase 3.8)", () => {
  it("foreign risk card renders LockBadge in header, not Edit/Delete", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[foreignRisk]}
          products={[{ id: "p1", name: "Product", overallStatus: "at-risk", stages: [] }]}
        />
      </SdlcTooltipProvider>,
    );

    expect(
      screen.getByLabelText("Read-only — authored by Alice"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit risk/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete risk/i }),
    ).not.toBeInTheDocument();
  });

  it("own risk card does not render LockBadge", () => {
    render(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[{ ...foreignRisk, foreign: false, authorName: "Alice" }]}
          products={[{ id: "p1", name: "Product", overallStatus: "at-risk", stages: [] }]}
        />
      </SdlcTooltipProvider>,
    );

    expect(
      screen.queryByRole("img", { name: /Read-only/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Edit risk/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete risk/i }),
    ).toBeInTheDocument();
  });
});

describe("RisksSection stage scope", () => {
  it("renders explicit all-stage selection as stage chips, not All stages", () => {
    render(
      <RisksSection
        risks={[{ ...baseRisk, stageIds: ["Dev", "Testing"] }]}
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    expect(screen.queryByText("All stages")).not.toBeInTheDocument();
    // "Dev" is canonicalized to "Development" before rendering (L4 fix).
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });

  it("keeps All stages only for omitted stage scope", () => {
    render(<RisksSection risks={[baseRisk]} />);

    expect(screen.getByText("All stages")).toBeInTheDocument();
  });

  it("renders every explicit stage without compacting", () => {
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
    // "Dev" is canonicalized to "Development" before rendering (L4 fix).
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });
});
