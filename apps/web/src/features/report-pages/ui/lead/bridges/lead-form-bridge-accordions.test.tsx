import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RisksAccordion } from "./lead-form-bridge-accordions";

vi.mock("./lead-form-sync-bridge", () => ({
  LeadFormSyncBridge: { Risks: () => null },
}));

function renderRisks(riskCount: number) {
  render(
    <RisksAccordion
      groupExpanded={false}
      riskCount={riskCount}
      productCount={1}
      activityCount={0}
      readOnly
      onAddRisk={vi.fn()}
    />,
  );
  return screen.getByText(String(riskCount));
}

describe("RisksAccordion counter", () => {
  it("stays muted at zero risks", () => {
    expect(renderRisks(0).getAttribute("style")).toBeNull();
  });

  it("takes the blocked tint once there is a risk", () => {
    expect(renderRisks(2).getAttribute("style")).toContain("destructive");
  });
});
