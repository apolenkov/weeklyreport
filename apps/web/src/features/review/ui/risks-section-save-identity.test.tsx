// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider } from "../../../shared/ui/feedback/sdlc-tooltip";
import type { Product, RiskEntry } from "../../report-sections";
import { RisksSection } from "./risks-section";

const product: Product = {
  id: "p1",
  name: "CRM",
  overallStatus: "at-risk",
  stages: [],
};

const existingRisk: RiskEntry = {
  id: "risk-1",
  productId: "p1",
  productName: "CRM",
  severity: "at-risk",
  stageNames: ["Dev"],
  text: "Vendor delay",
  impact: "Delivery slips",
  mitigation: "Escalate",
};

function renderSection(
  onChange: (next: readonly RiskEntry[]) => void,
  addSignal = 0,
) {
  return render(
    <SdlcTooltipProvider>
      <RisksSection
        risks={[existingRisk]}
        products={[product]}
        stagesForProduct={() => ["Dev"]}
        onChange={onChange}
        addSignal={addSignal}
      />
    </SdlcTooltipProvider>,
  );
}

function fillProse(text: string): void {
  fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
    target: { value: text },
  });
  fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
    target: { value: "Delivery slips" },
  });
  fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
    target: { value: "Escalate" },
  });
}

// The server replaces risk rows from this list; edits must replace their entry
// without appending a duplicate.
describe("RisksSection save identity", () => {
  it("saving an edit keeps one entry, carrying the edited risk's id", () => {
    const onChange = vi.fn<(next: readonly RiskEntry[]) => void>();
    renderSection(onChange);

    fireEvent.click(screen.getByRole("button", { name: /Edit risk for CRM/i }));
    fillProse("Vendor delay, now confirmed");
    fireEvent.click(screen.getByRole("button", { name: /^Save Risk$/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toHaveLength(1);
    expect(next?.[0]?.id).toBe(existingRisk.id);
    expect(next?.[0]?.text).toBe("Vendor delay, now confirmed");
  });

  it("saving a create appends exactly one entry with a fresh id", () => {
    const onChange = vi.fn<(next: readonly RiskEntry[]) => void>();
    const { rerender } = renderSection(onChange);

    // The parent form requests creation by advancing addSignal.
    rerender(
      <SdlcTooltipProvider>
        <RisksSection
          risks={[existingRisk]}
          products={[product]}
          stagesForProduct={() => ["Dev"]}
          onChange={onChange}
          addSignal={1}
        />
      </SdlcTooltipProvider>,
    );

    // A lone owned stage is applied automatically.
    fillProse("Second vendor at risk");
    fireEvent.click(screen.getByRole("button", { name: /^Save Risk$/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toHaveLength(2);
    expect(next?.[0]?.id).toBe(existingRisk.id);
    expect(next?.[1]?.id).not.toBe(existingRisk.id);
    expect(next?.[1]?.text).toBe("Second vendor at risk");
  });
});
