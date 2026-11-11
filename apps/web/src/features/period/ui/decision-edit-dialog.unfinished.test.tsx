// @vitest-environment jsdom
// An author may save a decision and add its impact later
// (openspec: lead-incomplete-record-drafts). Other editors keep it required.
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DecisionEntry, Product } from "../../report-sections";
import { DecisionCard } from "./decision-card";
import { DecisionEditDialog } from "./decision-edit-dialog";

const products: Product[] = [
  { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
];

const finished: DecisionEntry = {
  id: "d1",
  productId: "p1",
  productName: "CRM",
  text: "Choose a vendor",
  owner: "Test Lead",
  impact: "Unblocks delivery",
  deadline: null,
  stageNames: ["Dev"],
};

function renderDialog(args: {
  readonly decision: DecisionEntry | null;
  readonly unfinishedAllowed?: boolean;
  readonly onSave: (next: DecisionEntry) => void;
}) {
  return render(
    <DecisionEditDialog
      open
      decision={args.decision}
      defaultOwner="Test Lead"
      products={products}
      defaultProductId="p1"
      stagesForProduct={() => ["Dev"]}
      onSave={args.onSave}
      onCancel={() => undefined}
      unfinishedAllowed={args.unfinishedAllowed}
    />,
  );
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save decision" }));

const noop = () => undefined;

describe("DecisionEditDialog — unfinished decisions", () => {
  it("saves a decision without its impact on the author's form", () => {
    const onSave = vi.fn();
    renderDialog({ decision: null, unfinishedAllowed: true, onSave });

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Choose a vendor" },
    });
    expect(screen.getByLabelText(/^Impact/i)).not.toBeRequired();
    expect(screen.getByText(/Optional for now/)).toBeInTheDocument();
    save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Choose a vendor",
        owner: "Test Lead",
        impact: "",
        stageNames: ["Dev"],
      }),
    );
  });

  it("still requires the decision text", () => {
    const onSave = vi.fn();
    renderDialog({ decision: null, unfinishedAllowed: true, onSave });

    save();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Decision text is required",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the impact required where unfinished decisions are not allowed", () => {
    const onSave = vi.fn();
    renderDialog({ decision: null, onSave });

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Choose a vendor" },
    });
    save();

    expect(screen.getByLabelText(/^Impact \*/i)).toBeRequired();
    expect(screen.getByRole("alert")).toHaveTextContent("Impact is required");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not let a finished decision lose its impact", () => {
    const onSave = vi.fn();
    renderDialog({ decision: finished, unfinishedAllowed: true, onSave });

    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "" },
    });
    save();

    expect(screen.getByRole("alert")).toHaveTextContent("Impact is required");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("lets an unfinished decision be saved again and then finished", () => {
    const onSave = vi.fn();
    renderDialog({
      decision: { ...finished, impact: "" },
      unfinishedAllowed: true,
      onSave,
    });

    save();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "d1", impact: "" }),
    );

    fireEvent.change(screen.getByLabelText(/^Impact/i), {
      target: { value: "Unblocks delivery" },
    });
    save();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "d1", impact: "Unblocks delivery" }),
    );
  });
});

describe("DecisionCard — unfinished note", () => {
  const card = (decision: DecisionEntry) => (
    <DecisionCard
      decision={decision}
      readOnly
      publishedLocked={false}
      onEdit={noop}
      onDelete={noop}
    />
  );

  it("does not claim persistence without save evidence", () => {
    render(card({ ...finished, impact: "" }));

    expect(screen.getByTestId("decision-unfinished-note")).toHaveTextContent(
      "Unfinished — only you see it.",
    );
    expect(
      screen.getByTestId("decision-unfinished-note"),
    ).not.toHaveTextContent("Saved");
  });

  it("shows no note on a finished decision", () => {
    render(card(finished));

    expect(screen.queryByTestId("decision-unfinished-note")).toBeNull();
  });
});
