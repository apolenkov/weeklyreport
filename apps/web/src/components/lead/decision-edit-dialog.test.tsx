/**
 * A13 regression: typed text must survive parent re-renders that pass a new
 * stagesForProduct function reference (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has the stages prop in deps → fires on new ref →
 *             setText('') wipes user input.
 * After fix:  the stages prop is never in deps → state preserved.
 *
 * VA-0a: a11y regression tests for biome-ignore suppression justifications
 * (noStaticElementInteractions on backdrop, useKeyWithClickEvents on inner
 * dialog div, noAutofocus on textarea).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecisionEditDialog } from "./decision-edit-dialog";
import type { Product } from "./mock-data";

const products: Product[] = [
  { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
];

describe("DecisionEditDialog — A13 form-race regression", () => {
  it("preserves typed text when parent re-renders with a new stagesForProduct ref", () => {
    const stagesV1 = ["Planning", "Dev"] as const;

    const { rerender } = render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => stagesV1}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const textField = screen.getByLabelText(/^Decision \*/i);
    fireEvent.change(textField, {
      target: { value: "user typed this — must survive" },
    });
    expect(textField).toHaveValue("user typed this — must survive");

    // Simulate autosave parent re-render: new array reference, same values.
    const stagesV2 = ["Planning", "Dev"] as const;
    rerender(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => stagesV2}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    // A13 bug: before fix, text was wiped back to '' by useEffect firing on
    // the new availableStages reference.
    expect(textField).toHaveValue("user typed this — must survive");
  });

  it("saves with required fields when text, owner and impact are filled", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Approve Q3 hiring plan" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Unblocks team expansion" },
    });
    // unify-record-dialogs: a multi-stage product requires an explicit pick.
    fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Approve Q3 hiring plan",
      impact: "Unblocks team expansion",
      owner: "Test Lead",
    });
  });

  it("saves selected stageIds with the decision payload (UFB-014)", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Approve Q3 hiring plan" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Unblocks team expansion" },
    });
    // unify-record-dialogs: nothing pre-selected, so clicking "Planning" selects
    // exactly that stage.
    fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Approve Q3 hiring plan",
      stageIds: ["Planning"],
    });
  });

  it("restores existing stageIds when editing a decision (UFB-014)", () => {
    render(
      <DecisionEditDialog
        open={true}
        decision={{
          id: "decision-1",
          productId: "p1",
          productName: "CRM",
          text: "Approve release gate",
          owner: "Test Lead",
          impact: "Unblocks production rollout",
          deadline: null,
          stageIds: ["Dev"],
        }}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Planning" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dev" })).toBeChecked();
  });
});

// ---------------------------------------------------------------------------
// VA-0a — a11y regression catalog (high-priority unit-rtl rows)
// Source: openspec/changes/verify-a11y-recommended-flip/design.md
// Section: apps/web/src/components/lead/decision-edit-dialog.tsx
// ---------------------------------------------------------------------------

const defaultProps = {
  open: true,
  decision: null,
  defaultOwner: "Test Lead",
  stagesForProduct: () => ["Planning", "Dev"] as readonly string[],
  products,
  defaultProductId: "p1",
  onSave: vi.fn(),
} as const;

describe("DecisionEditDialog — VA-0a a11y (backdrop onKeyDown + click behavior)", () => {
  it("Escape on the backdrop div calls onCancel (noStaticElementInteractions justification)", () => {
    const onCancel = vi.fn();
    render(<DecisionEditDialog {...defaultProps} onCancel={onCancel} />);

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.keyDown(backdrop, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape on the backdrop div calls e.preventDefault()", () => {
    const onCancel = vi.fn();
    render(<DecisionEditDialog {...defaultProps} onCancel={onCancel} />);

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    backdrop.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("Cancel button click calls onCancel (keyboard-closable alternative justification)", () => {
    const onCancel = vi.fn();
    render(<DecisionEditDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape fired on the inner dialog div still calls onCancel (event bubbles to backdrop)", () => {
    const onCancel = vi.fn();
    render(<DecisionEditDialog {...defaultProps} onCancel={onCancel} />);

    const dialogDiv = screen.getByRole("dialog");
    fireEvent.keyDown(dialogDiv, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking the inner dialog div does NOT call onCancel (stopPropagation guard)", () => {
    const onCancel = vi.fn();
    render(<DecisionEditDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("dialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("clicking the backdrop div calls onCancel", () => {
    const onCancel = vi.fn();
    render(<DecisionEditDialog {...defaultProps} onCancel={onCancel} />);

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");
    // Fire click directly on the backdrop element (not on a child).
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("dec-text textarea receives document focus on mount (initial modal focus)", () => {
    render(<DecisionEditDialog {...defaultProps} onCancel={vi.fn()} />);

    const textarea = document.getElementById("dec-text");
    expect(document.activeElement).toBe(textarea);
  });
});

/**
 * D12 mount/unmount shell: the outer component returns null when closed and
 * remounts fresh content on reopen, so typed-but-cancelled state never leaks
 * into the next open. This is the structural replacement for the deleted
 * useEffect form-reset.
 */
describe("DecisionEditDialog — D12 reopen renders fresh state", () => {
  it("does not leak typed text from a cancelled create into the next open", () => {
    const { rerender } = render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "draft that should be discarded" },
    });
    expect(screen.getByLabelText(/^Decision \*/i)).toHaveValue(
      "draft that should be discarded",
    );

    // Cancel = close → the shell unmounts the content.
    rerender(
      <DecisionEditDialog
        open={false}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );
    expect(screen.queryByLabelText(/^Decision \*/i)).not.toBeInTheDocument();

    // Reopen → fresh mount, empty field.
    rerender(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByLabelText(/^Decision \*/i)).toHaveValue("");
  });
});

// require-stage-on-items-and-decisions: a decision must carry a concrete stage
// when the lead owns stages (parity with the risk dialog).
describe("DecisionEditDialog — require a stage", () => {
  it("blocks save with no stage when stages are available", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );
    // unify-record-dialogs: create starts with no stage selected, so the gap is
    // reached without any deselection.
    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "A decision without a stage" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Some impact" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Select at least one stage/i)).toBeInTheDocument();
  });

  it("auto-applies a single owned stage so save succeeds", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Single-stage decision" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Some impact" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // stage-label-canonicalization 1.2: the auto-applied "Dev" owned stage is
    // persisted as the canonical "Development", never the short alias.
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageIds: ["Development"],
    });
  });
});

// unify-record-dialogs: changing the product re-scopes the stage options to the
// new product and CLEARS the prior selection — never defaults to all owned
// stages (regression guard: the product-switch handler once selected them all).
describe("DecisionEditDialog — product switch re-scopes + clears stages", () => {
  const twoProducts: Product[] = [
    { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
    { id: "p2", name: "ERP", overallStatus: "on-track", stages: [] },
  ];
  const stagesByProduct = (productId: string) =>
    productId === "p1" ? ["Planning", "Dev"] : ["Analysis", "Design"];

  it("clears the selection and shows the new product's stages on switch", () => {
    render(
      <DecisionEditDialog
        open
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={stagesByProduct}
        products={twoProducts}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );
    // Pick a stage on the first product.
    fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
    expect(screen.getByRole("checkbox", { name: "Planning" })).toBeChecked();

    // Switch product → options re-scope to p2 and nothing stays checked.
    fireEvent.change(screen.getByLabelText(/^Product/i), {
      target: { value: "p2" },
    });
    expect(screen.queryByRole("checkbox", { name: "Planning" })).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Analysis" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Design" })).not.toBeChecked();
  });
});
