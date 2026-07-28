/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- RTL DOM-element casts are required by the app tsconfig for value, checked, and options access. */
/**
 * Typed text must survive parent re-renders that pass a new
 * stagesForProduct function reference (autosave → React Query invalidate cycle).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { ItemEditDialog } from "./item-edit-dialog";

const products: Product[] = [
  { id: "p1", name: "DevOps Tools", overallStatus: "on-track", stages: [] },
];

const defaultA11yProps = {
  open: true,
  item: null,
  products,
  week: "current" as const,
  defaultProductId: "p1",
  onSave: vi.fn(),
} as const;

describe("ItemEditDialog — backdrop keyboard and click behavior", () => {
  it("Escape on the backdrop div calls onCancel (noStaticElementInteractions justification)", () => {
    const onCancel = vi.fn();
    render(<ItemEditDialog {...defaultA11yProps} onCancel={onCancel} />);

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
    render(<ItemEditDialog {...defaultA11yProps} onCancel={onCancel} />);

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
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Cancel button click calls onCancel (keyboard-closable alternative justification)", () => {
    const onCancel = vi.fn();
    render(<ItemEditDialog {...defaultA11yProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking the inner dialog div does NOT call onCancel (stopPropagation guard)", () => {
    const onCancel = vi.fn();
    render(<ItemEditDialog {...defaultA11yProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("dialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("clicking the backdrop div calls onCancel", () => {
    const onCancel = vi.fn();
    render(<ItemEditDialog {...defaultA11yProps} onCancel={onCancel} />);

    const backdrop = document.querySelector('[role="presentation"]');
    if (!backdrop) throw new Error("backdrop [role=presentation] not found");
    // Fire click directly on the backdrop element (not on a child).
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("item-text textarea receives document focus on mount (initial modal focus via autoFocus)", () => {
    render(<ItemEditDialog {...defaultA11yProps} onCancel={vi.fn()} />);

    const textarea = document.getElementById("item-text");
    expect(document.activeElement).toBe(textarea);
  });

  it("Escape fired on textarea still calls onCancel (event bubbles to backdrop onKeyDown)", () => {
    const onCancel = vi.fn();
    render(<ItemEditDialog {...defaultA11yProps} onCancel={onCancel} />);

    const textarea = document.getElementById("item-text");
    expect(textarea).not.toBeNull();
    if (!textarea) throw new Error("textarea not found");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

/** An item may reference a product outside the lead's stage-owned products. */
describe("ItemEditDialog — cross-stage product preservation", () => {
  it("keeps the original product on save when its id is outside the stage-owned list", () => {
    const onSave = vi.fn();
    const crossStageItem: KanbanItem = {
      id: "item-cross",
      productId: "p-foreign",
      productName: "Payments Gateway",
      // A cross-stage row already carries a stage, so it remains saveable even
      // when the lead owns nothing on p-foreign.
      stageNames: ["Integration"],
      text: "Integrate payment provider",
      status: "in-progress",
      author: "Test Lead",
    };

    render(
      <ItemEditDialog
        open={true}
        item={crossStageItem}
        products={products}
        week="current"
        stagesForProduct={(productId) =>
          productId === "p1" ? ["Dev", "Testing"] : []
        }
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      productId: "p-foreign",
      productName: "Payments Gateway",
    });
  });
});

// Stage options are scoped to the author's owned stages. A single owned stage
// is locked, product changes re-scope the options, and Save is disabled when
// the selected product has no owned stage.
describe("ItemEditDialog — stage-ownership scoping", () => {
  it("visibly pre-selects and locks a single owned stage (no checkbox to deselect)", () => {
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const lockedPill = screen.getByText("Applied automatically").parentElement;
    expect(lockedPill).toHaveTextContent("Dev");
    // Locked: no checkbox exists, so the single stage cannot be deselected.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save Item/i }),
    ).not.toBeDisabled();
  });

  it("re-scopes the stage options when the product changes", () => {
    const twoProducts: Product[] = [
      { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
      { id: "p2", name: "Billing", overallStatus: "on-track", stages: [] },
    ];
    render(
      <ItemEditDialog
        open
        item={null}
        products={twoProducts}
        week="current"
        defaultProductId="p1"
        stagesForProduct={(id) =>
          id === "p1" ? ["Dev", "Testing"] : ["Analysis"]
        }
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Testing" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Product/i), {
      target: { value: "product:p2" },
    });

    expect(screen.queryByRole("checkbox", { name: "Testing" })).toBeNull();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
  });

  const foreignItem: KanbanItem = {
    id: "i-foreign",
    productId: "p-foreign",
    productName: "Payments Gateway",
    text: "Legacy cross item",
    status: "in-progress",
    author: "Test Lead",
  };

  it("disables Save and shows contact-admin on a zero-owned-stage product", () => {
    render(
      <ItemEditDialog
        open
        item={foreignItem}
        products={products}
        week="current"
        stagesForProduct={() => []}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Save Item/i })).toBeDisabled();
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
      <ItemEditDialog
        open
        item={foreignItem}
        products={products}
        week="current"
        stagesForProduct={() => []}
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

// An item must carry a concrete stage when the product has owned stages.
describe("ItemEditDialog — require a stage", () => {
  it("blocks save with no stage on a multi-stage product", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );
    // Create starts with no stage selected, so no deselection is needed.
    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "An item without a stage" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Select at least one stage/i)).toBeInTheDocument();
  });

  it("auto-applies a single owned stage so save succeeds", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "Single-stage item" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // The auto-applied "Dev" stage is persisted as canonical "Development".
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageNames: ["Development"],
    });
  });

  it("saves when at least one stage is selected on a multi-stage product", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "Item on Testing only" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageNames: ["Testing"],
    });
  });
});

describe("ItemEditDialog — activity parenting", () => {
  const productsWithStages: Product[] = [
    { id: "p1", name: "DevOps Tools", overallStatus: "on-track", stages: [] },
  ];
  const activities = [{ id: "act1", name: "Jira triage duty" }];

  it("hides the stage step and saves an activity-parented item with no stage", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={productsWithStages}
        activities={activities}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    // A product parent shows the stage step.
    expect(screen.getByText(/SDLC Stages/i)).toBeInTheDocument();

    // Switch the parent to the activity — the stage step disappears.
    fireEvent.change(screen.getByLabelText("Parent"), {
      target: { value: "activity:act1" },
    });
    expect(screen.queryByText(/SDLC Stages/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "Triaged 12 tickets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]?.[0] as KanbanItem;
    expect(saved.activityId).toBe("act1");
    expect(saved.productId).toBe("");
    expect(saved.stageNames).toBeUndefined();
    expect(saved.text).toBe("Triaged 12 tickets");
  });
});

describe("ItemEditDialog — status lock and blocker routing", () => {
  const coveredItem: KanbanItem = {
    id: "i1",
    productId: "p1",
    productName: "DevOps Tools",
    stageNames: ["Development"],
    status: "in-progress",
    text: "wip",
    author: "You",
  };
  const coveringRisk: RiskEntry = {
    id: "r1",
    productId: "p1",
    productName: "DevOps Tools",
    stageNames: ["Development"],
    severity: "blocked",
    text: "A real covering blocker",
    impact: "impact",
    mitigation: "mitigation",
  };

  it("shows the in-dialog locked message and hides the status chips for a covered item", () => {
    render(
      <ItemEditDialog
        open
        item={coveredItem}
        products={products}
        week="current"
        risks={[coveringRisk]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Status is set by the covering risk\/blocker/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /In Progress/i }),
    ).not.toBeInTheDocument();
  });

  it("offers exactly the item type's vocabulary — current chips", () => {
    render(
      <ItemEditDialog
        open
        item={{ ...coveredItem, id: "i4" }}
        products={products}
        week="current"
        risks={[]}
        stagesForProduct={() => ["Development"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const status = screen.getByText("Status").parentElement;
    expect(status).not.toBeNull();
    if (!status) throw new Error("status controls not found");
    expect(
      within(status)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["! In Progress", "‖ Paused", "✓ Completed"]);
  });

  it("offers exactly the item type's vocabulary — next chips", () => {
    render(
      <ItemEditDialog
        open
        item={{ ...coveredItem, id: "i5", status: "planned" }}
        products={products}
        week="next"
        risks={[]}
        stagesForProduct={() => ["Development"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Planned/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Postponed/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /In Progress/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ItemEditDialog — activity-lane + Add preselects the activity", () => {
  const activities = [{ id: "act-1", name: "Jira triage duty" }];

  it("opens create mode with the seed activity as parent and no stage step", () => {
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        activities={activities}
        week="current"
        defaultProductId="p1"
        defaultActivityId="act-1"
        stagesForProduct={() => ["Dev", "Testing"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // The seed activity beats the baked-in default product.
    const parentSelect = screen.getByLabelText("Parent") as HTMLSelectElement;
    expect(parentSelect.value).toBe("activity:act-1");
    // An activity parent owns no SDLC stage — the stage step is hidden.
    expect(screen.queryByText(/SDLC Stages/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Jira triage duty/ }),
    ).toBeInTheDocument();
  });
});
