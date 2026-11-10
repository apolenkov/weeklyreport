// @vitest-environment jsdom
// An author may save a named risk and add its impact and mitigation later
// (openspec: lead-incomplete-record-drafts). Other editors keep both required.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SdlcTooltipProvider } from "../../../shared/ui/feedback/sdlc-tooltip";
import type { Product, RiskEntry } from "../../report-sections";
import { RiskCard } from "./risk-card";
import { RiskEditDialog } from "./risk-edit-dialog";
import { collectRiskErrors } from "./risk-edit-dialog-helpers";

const products: Product[] = [
  { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
];

const finished: RiskEntry = {
  id: "risk-1",
  productId: "p1",
  productName: "CRM",
  severity: "at-risk",
  stageNames: ["Dev"],
  text: "Vendor delay",
  impact: "Delivery slips",
  mitigation: "Escalate",
};

function renderDialog(args: {
  readonly risk: RiskEntry | null;
  readonly unfinishedAllowed?: boolean;
  readonly onSave: (next: RiskEntry) => void;
}) {
  return render(
    <RiskEditDialog
      open
      risk={args.risk}
      products={products}
      onSave={args.onSave}
      onCancel={() => undefined}
      defaultProductId="p1"
      stagesForProduct={() => ["Dev"]}
      unfinishedAllowed={args.unfinishedAllowed}
    />,
  );
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save risk" }));

describe("RiskEditDialog — unfinished risks", () => {
  it("saves a named risk without details on the author's form", () => {
    const onSave = vi.fn();
    renderDialog({ risk: null, unfinishedAllowed: true, onSave });

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Vendor may slip" },
    });
    expect(screen.getByLabelText(/^Impact/i)).not.toBeRequired();
    expect(screen.getByText(/Optional for now/)).toBeInTheDocument();
    save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Vendor may slip",
        impact: "",
        mitigation: "",
        stageNames: ["Dev"],
      }),
    );
  });

  it("still requires the name", () => {
    const onSave = vi.fn();
    renderDialog({ risk: null, unfinishedAllowed: true, onSave });

    save();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Risk description is required",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps details required where unfinished risks are not allowed", () => {
    const onSave = vi.fn();
    renderDialog({ risk: null, onSave });

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Vendor may slip" },
    });
    save();

    expect(screen.getByText("Impact is required")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not let a finished risk lose its details", () => {
    const onSave = vi.fn();
    renderDialog({ risk: finished, unfinishedAllowed: true, onSave });

    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "" },
    });
    save();

    expect(screen.getByText("Impact is required")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("checks a written optional detail against the shared limits", () => {
    const errors = collectRiskErrors({
      text: "Risk",
      impact: "​",
      mitigation: " ",
      isActivityParent: true,
      effectiveStageNames: [],
      detailsOptional: true,
    });

    expect(errors.impact).toContain("visible text");
    expect(errors.mitigation).toBeUndefined();
  });
});

describe("RiskCard — unfinished note", () => {
  const renderCard = (risk: RiskEntry) =>
    render(
      <SdlcTooltipProvider>
        <RiskCard
          risk={risk}
          readOnly={false}
          onEdit={() => undefined}
          onDelete={() => undefined}
        />
      </SdlcTooltipProvider>,
    );

  it("tells the author a saved risk is unfinished", () => {
    renderCard({ ...finished, impact: "", mitigation: "Escalate" });

    expect(screen.getByTestId("risk-unfinished-note")).toHaveTextContent(
      "Saved, unfinished",
    );
  });

  it("adds no note to a finished risk", () => {
    renderCard(finished);

    expect(screen.queryByTestId("risk-unfinished-note")).toBeNull();
  });
});
