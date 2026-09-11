// Stage selection is required for a product parent (empty = validation error);
// options come from the lead's StageAssignment rows via stagesForProduct.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import type { Product } from "../../report-sections";
import { RiskEditDialog } from "./risk-edit-dialog";

const products: Product[] = [
  {
    id: "p1",
    name: "CRM",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Development",
        status: "on-track",
        ownership: "mine",
        assignee: "Test Lead",
      },
    ],
  },
];

describe("RiskEditDialog - SDLC stage selector", () => {
  it("clears only the old parent's stage error and validates the selected parent on save", () => {
    const onSave = vi.fn();
    const twoProducts: Product[] = [
      { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
      { id: "p2", name: "Billing", overallStatus: "on-track", stages: [] },
    ];
    render(
      <RiskEditDialog
        open
        risk={null}
        products={twoProducts}
        defaultProductId="p1"
        stagesForProduct={(id) =>
          id === "p1" ? ["Development", "Testing"] : ["Analysis"]
        }
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    const save = screen.getByRole("button", { name: "Save Risk" });
    fireEvent.click(save);
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
    const text = screen.getByLabelText(/^Risk \*/i);
    expect(text).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Product"), {
      target: { value: "product:p2" },
    });
    expect(
      screen.queryByText("Select at least one stage."),
    ).not.toBeInTheDocument();
    expect(text).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Applied automatically")).toBeInTheDocument();

    fireEvent.change(text, { target: { value: "Vendor delay" } });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Delivery slips" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Escalate" },
    });
    fireEvent.change(screen.getByLabelText("Product"), {
      target: { value: "product:p1" },
    });
    fireEvent.click(save);
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Product"), {
      target: { value: "product:p2" },
    });
    expect(
      screen.queryByText("Select at least one stage."),
    ).not.toBeInTheDocument();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Vendor delay",
      impact: "Delivery slips",
      mitigation: "Escalate",
      productId: "p2",
      stageNames: ["Analysis"],
    });
  });

  it("starts with empty stage selection when no stages are flagged in create mode", () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    // Both checkboxes should start unchecked (no flagged stages in pipeline).
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Vendor delay" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Slips Q3" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Escalate" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    // Required stage validation: onSave not called, error message shown.
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Select at least one stage/i)).toBeInTheDocument();
  });

  it("saves selected Blocked severity", () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development"]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Critical vendor outage" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Work is stopped" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Escalate immediately" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Blocked/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Critical vendor outage",
      severity: "blocked",
    });
  });

  it("saves with stageName when all required fields including stage are filled", () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Vendor delay" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Slips Q3" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Escalate" },
    });
    // No stages are pre-selected (none are at-risk/blocked). Select Development explicitly.
    fireEvent.click(screen.getByRole("checkbox", { name: "Development" }));

    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // The selected canonical stage is persisted in the payload.
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageNames: ["Development"],
      text: "Vendor delay",
      impact: "Slips Q3",
      mitigation: "Escalate",
    });
  });

  it("limits stage checkboxes to stages returned by stagesForProduct", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Testing", "Support"]}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const labels = checkboxes.map((cb) =>
      expectDefined(cb.parentElement).textContent.trim(),
    );
    expect(labels).toEqual(["Testing", "Support"]);
  });

  it("switching product clears the stage selection, never selects all owned stages", () => {
    // A product switch must not default to every owned stage: selecting all
    // would inflate own-input completeness, so the lead marks stages
    // explicitly and every checkbox starts unchecked.
    const twoProducts: Product[] = [
      { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
      { id: "p2", name: "Billing", overallStatus: "on-track", stages: [] },
    ];
    render(
      <RiskEditDialog
        open
        risk={null}
        products={twoProducts}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={(id) =>
          id === "p2" ? ["Development", "Testing"] : ["Planning"]
        }
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "product:p2" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.map((cb) => (cb as HTMLInputElement).checked)).toEqual([
      false,
      false,
    ]);
  });

  it("shows flagged pipeline stages without selecting them for a new risk", () => {
    const productsWithFlags: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "blocked",
        stages: [
          {
            stageName: "Development",
            status: "blocked",
            ownership: "mine",
            assignee: "Lead",
          },
          {
            stageName: "Testing",
            status: "at-risk",
            ownership: "mine",
            assignee: "Lead",
          },
        ],
      },
    ];

    render(
      <RiskEditDialog
        open
        risk={null}
        products={productsWithFlags}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    // The context strip text contains both product name and stage/severity info.
    expect(
      screen.getByText(/Already flagged in SDLC pipeline/i),
    ).toBeInTheDocument();
    // Strip header mentions at least one flagged stage.
    expect(screen.getByText(/CRM →/)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();
  });

  it("hides context strip when no stages are flagged in pipeline", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    expect(
      screen.queryByText(/Already flagged in SDLC pipeline/i),
    ).not.toBeInTheDocument();
  });

  it("severity stays Blocked after user selects it and then toggles a stage checkbox", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Blocked/i }));
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Toggle Development stage checkbox — severity must NOT flip back to at-risk.
    fireEvent.click(screen.getByRole("checkbox", { name: "Development" }));

    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /At Risk/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("derives initial severity Blocked when pipeline stage is blocked on dialog open", () => {
    const productsBlocked: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "blocked",
        stages: [
          {
            stageName: "Development",
            status: "blocked",
            ownership: "mine",
            assignee: "Lead",
          },
        ],
      },
    ];

    render(
      <RiskEditDialog
        open
        risk={null}
        products={productsBlocked}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development"]}
      />,
    );

    // Single blocked stage → derived severity should be Blocked.
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("preserves risk.severity when editing an existing risk (does not re-derive)", () => {
    const productsBlocked: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "blocked",
        stages: [
          {
            stageName: "Development",
            status: "blocked",
            ownership: "mine",
            assignee: "Lead",
          },
        ],
      },
    ];

    render(
      <RiskEditDialog
        open
        risk={{
          id: "r1",
          productId: "p1",
          productName: "CRM",
          stageNames: ["Development"],
          severity: "at-risk",
          text: "Old risk",
          impact: "",
          mitigation: "",
        }}
        products={productsBlocked}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development"]}
      />,
    );

    // Edit mode: risk.severity="at-risk" must win over pipeline's "blocked".
    expect(screen.getByRole("button", { name: /At Risk/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders Save Risk and Cancel buttons in the sticky footer", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development"]}
      />,
    );

    const save = screen.getByRole("button", { name: /Save Risk/i });
    const cancel = screen.getByRole("button", { name: /Cancel/i });
    expect(save.parentElement).toHaveClass("sticky");
    expect(cancel.parentElement).toBe(save.parentElement);
  });

  it("renders all fields in a balanced two-column layout with a Classification panel", () => {
    // md+ two-column grid keeps the product picker on-screen; assert the grid
    // and that every field is still present after the relayout.
    render(
      <RiskEditDialog
        open
        risk={null}
        products={[
          ...products,
          { id: "p2", name: "Billing", overallStatus: "on-track", stages: [] },
        ]}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    expect(document.querySelector('[class*="md:grid-cols-2"]')).not.toBeNull();
    expect(screen.getByText("Classification")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Risk \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Impact \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mitigation \*/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /At Risk/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Blocked/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Product/i)).toBeInTheDocument();
  });
});
