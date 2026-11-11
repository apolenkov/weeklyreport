// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DecisionEntry } from "../../report-sections";
import { DecisionsSection } from "./decisions-section";

const decision: DecisionEntry = {
  id: "decision-row",
  stableId: "decision-lineage",
  productId: "product",
  productName: "Product",
  text: "Choose a vendor",
  owner: "Lead",
  impact: "Unblocks delivery",
  deadline: null,
  stageNames: ["Development"],
};
type OnChange = (rows: DecisionEntry[]) => void;

const products = [
  {
    id: "product",
    name: "Product",
    overallStatus: "on-track" as const,
    stages: [],
  },
];

function surface(
  rows: readonly DecisionEntry[],
  locked: readonly string[],
  onChange: OnChange,
) {
  return (
    <DecisionsSection
      decisions={rows}
      publishedLockedIds={new Set(locked)}
      products={products}
      stagesForProduct={() => ["Development"]}
      unfinishedAllowed
      onChange={onChange}
    />
  );
}

function editAndClear() {
  fireEvent.click(
    screen.getByRole("button", { name: "Edit decision: Choose a vendor" }),
  );
  fireEvent.change(screen.getByLabelText(/^Decision \*/), {
    target: { value: "My revised decision" },
  });
  fireEvent.change(screen.getByLabelText(/^Impact/), { target: { value: "" } });
}

function rejectThenCorrect(onChange: OnChange, savedId = decision.id) {
  fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
  const impact = screen.getByLabelText(/^Impact/);
  expect(impact).toHaveFocus();
  expect(impact).toHaveAttribute("aria-invalid", "true");
  expect(impact).toHaveAccessibleDescription(/published.*Restore.*Impact/i);
  expect(screen.getByLabelText(/^Decision \*/)).toHaveValue(
    "My revised decision",
  );
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(impact, { target: { value: "The new delivery impact" } });
  fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith([
    expect.objectContaining({
      id: savedId,
      text: "My revised decision",
      impact: "The new delivery impact",
      stableId: decision.stableId,
    }),
  ]);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
}

describe("published decision Impact guidance", () => {
  it("links the refusal to Impact, keeps the other edits, and accepts a valid correction", () => {
    const onChange = vi.fn<OnChange>();
    render(surface([decision], [decision.id], onChange));
    editAndClear();
    rejectThenCorrect(onChange);
  });

  it("uses newly observed publication after opening an unfinished decision", () => {
    const onChange = vi.fn<OnChange>();
    const unfinished = { ...decision, impact: "" };
    const { rerender } = render(surface([unfinished], [], onChange));
    editAndClear();
    rerender(surface([decision], [decision.id], onChange));
    rejectThenCorrect(onChange);
  });
  it("keeps the publication guard and corrected save on the same lineage after row ids change", () => {
    const onChange = vi.fn<OnChange>();
    const { rerender } = render(
      surface([{ ...decision, impact: "" }], [], onChange),
    );
    editAndClear();
    const reminted = { ...decision, id: "reminted-row" };
    rerender(surface([reminted], [reminted.id], onChange));
    rejectThenCorrect(onChange, reminted.id);
  });
});
