// Typed text survives autosave-driven parent renders with a new stages ref;
// the ref is not form state. Also covers backdrop Escape and autofocus a11y.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DecisionEntry, Product } from "../../report-sections";
import { DecisionEditDialog } from "./decision-edit-dialog";

const products: Product[] = [
  { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
];

describe("DecisionEditDialog — form-race regression", () => {
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

    // A new availableStages reference must not wipe the field via useEffect.
    expect(textField).toHaveValue("user typed this — must survive");
  });

  it("saves text + impact; owner is auto-set to the author with no owner field", () => {
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

    // Owner is no longer a field — it is auto-set to the author (defaultOwner).
    expect(document.getElementById("dec-owner")).toBeNull();
    expect(screen.queryByLabelText(/^Owner/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Approve Q3 hiring plan" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Unblocks team expansion" },
    });
    // Multi-stage product requires an explicit stage pick.
    fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Approve Q3 hiring plan",
      impact: "Unblocks team expansion",
      // Persisted from defaultOwner even though there is no input for it.
      owner: "Test Lead",
    });
  });

  it("saves selected stageNames with the decision payload", () => {
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
    // Nothing pre-selected; clicking "Planning" selects exactly that stage.
    fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Approve Q3 hiring plan",
      stageNames: ["Planning"],
    });
  });

  it("restores existing stageNames when editing a decision", () => {
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
          stageNames: ["Dev"],
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

  it("editing preserves the decision's existing owner, not defaultOwner", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open
        decision={{
          id: "decision-1",
          productId: "p1",
          productName: "CRM",
          text: "Approve release gate",
          owner: "Original Owner",
          impact: "Unblocks production rollout",
          deadline: null,
          stageNames: ["Dev"],
        }}
        defaultOwner="Different Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // owner comes from the decision, not the (different) defaultOwner prop.
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      owner: "Original Owner",
    });
  });
});

const defaultProps = {
  open: true,
  decision: null,
  defaultOwner: "Test Lead",
  stagesForProduct: () => ["Planning", "Dev"] as readonly string[],
  products,
  defaultProductId: "p1",
  onSave: vi.fn(),
} as const;

describe("DecisionEditDialog — a11y (backdrop onKeyDown + click behavior)", () => {
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

// Closed shell returns null and remounts fresh — cancelled draft must not leak.
describe("DecisionEditDialog — reopen renders fresh state", () => {
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

// Decision must carry a concrete stage when the lead owns stages.
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
    // Create starts with no stage selected — gap needs no deselection step.
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
      stageNames: ["Development"],
    });
  });
});

// Product switch re-scopes stages and clears prior selection (never all-owned).
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
      target: { value: "product:p2" },
    });
    expect(screen.queryByRole("checkbox", { name: "Planning" })).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Analysis" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Design" })).not.toBeChecked();
  });
});

// Single owned stage locks; zero-owned-stage product dead-ends Save.
describe("DecisionEditDialog — stage-ownership scoping", () => {
  it("visibly pre-selects and locks a single owned stage (no checkbox to deselect)", () => {
    render(
      <DecisionEditDialog
        open
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const lockedPill = screen.getByText("Applied automatically").parentElement;
    expect(lockedPill).toHaveTextContent("Dev");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save Decision/i }),
    ).not.toBeDisabled();
  });

  const foreignDecision: DecisionEntry = {
    id: "d-foreign",
    productId: "p-foreign",
    productName: "Payments Gateway",
    text: "Legacy cross decision",
    owner: "Test Lead",
    impact: "Some impact",
    deadline: null,
  };

  it("disables Save and shows contact-admin on a zero-owned-stage product", () => {
    render(
      <DecisionEditDialog
        open
        decision={foreignDecision}
        defaultOwner="Test Lead"
        stagesForProduct={() => []}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Save Decision/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        /no stages assigned on Payments Gateway — contact admin/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Select at least one stage/i),
    ).not.toBeInTheDocument();
  });

  it("makes the keyboard save shortcut a no-op on a zero-owned-stage product", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open
        decision={foreignDecision}
        defaultOwner="Test Lead"
        stagesForProduct={() => []}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.keyDown(backdrop, { key: "Enter", ctrlKey: true });

    expect(onSave).not.toHaveBeenCalled();
  });
});

// Activity parent hides the stage step and saves an activity-parented payload.
describe("DecisionEditDialog — activity parenting", () => {
  const activities = [{ id: "act1", name: "Jira triage duty" }];

  it("hides the stage step and saves an activity-parented decision with no stage", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open
        decision={null}
        defaultOwner="Test Lead"
        stagesForProduct={() => ["Planning", "Dev"]}
        products={products}
        activities={activities}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    // A product parent shows the stage step (its checkboxes).
    expect(
      screen.getByRole("checkbox", { name: "Planning" }),
    ).toBeInTheDocument();

    // Switch the parent to the activity — the stage step disappears.
    fireEvent.change(screen.getByLabelText("Parent"), {
      target: { value: "activity:act1" },
    });
    expect(screen.queryByRole("checkbox", { name: "Planning" })).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Escalate triage backlog" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Backlog cleared next sprint" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]?.[0] as DecisionEntry;
    expect(saved.activityId).toBe("act1");
    expect(saved.productId).toBe("");
    expect(saved.stageNames).toBeUndefined();
    expect(saved.activityName).toBe("Jira triage duty");
    expect(saved.text).toBe("Escalate triage backlog");
  });
});
