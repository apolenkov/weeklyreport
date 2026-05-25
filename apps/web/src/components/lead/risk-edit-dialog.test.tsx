/**
 * 35-04 / UFB-014: the Risk dialog uses an OPTIONAL multi-stage selector
 * (`StageMultiSelect`). Options come from `stagesForProduct(productId)`
 * — the lead's StageAssignment rows.
 *
 * UFB-073 (revised): in create mode, only stages that are already
 * marked at-risk/blocked on the SDLC pipeline are pre-selected.
 * If none are flagged, the selection starts empty (= applies to all).
 *
 * Phase 3.5: required stage selection (empty = validation error);
 * bidirectional severity decouple; context strip from pipeline.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { RiskEditDialog } from "./risk-edit-dialog";
import type { Product } from "./mock-data";

const products: Product[] = [
  {
    id: "p1",
    name: "CRM",
    overallStatus: "on-track",
    stages: [],
  },
];

describe("RiskEditDialog - SDLC stage selector (35-04 / UFB-014)", () => {
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
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    // Both checkboxes should start unchecked (no flagged stages in pipeline).
    expect(screen.getByRole("checkbox", { name: "Dev" })).not.toBeChecked();
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

  it("pre-selects only at-risk/blocked stages when opening create dialog", () => {
    const onSave = vi.fn();
    const productsWithRiskyStage: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "at-risk",
        stages: [
          { stageName: "Dev", status: "blocked", ownership: "mine", assignee: "Lead" },
          { stageName: "Testing", status: "on-track", ownership: "mine", assignee: "Lead" },
        ],
      },
    ];

    render(
      <RiskEditDialog
        open
        risk={null}
        products={productsWithRiskyStage}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Critical outage" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Work stopped" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Escalate" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // Only "Dev" (blocked) should be pre-selected; "Testing" (on-track) must not.
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageIds: ["Dev"],
    });
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
        stagesForProduct={() => ["Dev"]}
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
        stagesForProduct={() => ["Dev", "Testing"]}
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
    // No stages are pre-selected (none are at-risk/blocked). Select 'Dev' explicitly.
    fireEvent.click(screen.getByRole("checkbox", { name: "Dev" }));

    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageIds: ["Dev"],
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
      cb.parentElement?.textContent?.trim(),
    );
    expect(labels).toEqual(["Testing", "Support"]);
  });

  it("pre-selects canonical stage when pipeline uses alias (Dev → Development)", () => {
    const onSave = vi.fn();
    const productsWithAlias: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "blocked",
        stages: [
          { stageName: "Dev", status: "blocked", ownership: "mine", assignee: "Lead" },
          { stageName: "Testing", status: "on-track", ownership: "mine", assignee: "Lead" },
        ],
      },
    ];

    render(
      <RiskEditDialog
        open
        risk={null}
        products={productsWithAlias}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Outage" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Down" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Fix" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // "Dev" (seed) canonicalizes to "Development" (owned) — pre-select must match.
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageIds: ["Development"],
    });
  });

  it("renders context strip showing pre-selected stages from pipeline", () => {
    const productsWithFlags: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "blocked",
        stages: [
          { stageName: "Dev", status: "blocked", ownership: "mine", assignee: "Lead" },
          { stageName: "Testing", status: "at-risk", ownership: "mine", assignee: "Lead" },
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
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    // The context strip text contains both product name and stage/severity info.
    expect(
      screen.getByText(/Pre-selected from SDLC pipeline/i),
    ).toBeInTheDocument();
    // Strip header mentions at least one flagged stage.
    expect(screen.getByText(/CRM →/)).toBeInTheDocument();
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
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    expect(
      screen.queryByText(/Pre-selected from SDLC pipeline/i),
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
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Blocked/i }));
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Toggle Dev stage checkbox — severity must NOT flip back to at-risk.
    fireEvent.click(screen.getByRole("checkbox", { name: "Dev" }));

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
            stageName: "Dev",
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
        stagesForProduct={() => ["Dev"]}
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
            stageName: "Dev",
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
          stageIds: ["Dev"],
          severity: "at-risk",
          text: "Old risk",
          impact: "",
          mitigation: "",
        }}
        products={productsBlocked}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );

    // Edit mode: risk.severity="at-risk" must win over pipeline's "blocked".
    expect(
      screen.getByRole("button", { name: /At Risk/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Blocked/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  // P3.6 layout smoke tests
  it("renders Save Risk and Cancel buttons in the sticky footer", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );

    const save = screen.getByRole("button", { name: /Save Risk/i });
    const cancel = screen.getByRole("button", { name: /Cancel/i });
    expect(save.parentElement).toHaveClass("sticky");
    expect(cancel.parentElement).toBe(save.parentElement);
  });

  it("uses two-column grid layout on md+ viewports", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );

    // The form grid wrapping both columns.
    const grid = document
      .querySelector('[class*="md:grid-cols-"]');
    expect(grid).not.toBeNull();
  });
});

/**
 * A13/A15 regression: typed text AND selected severity must survive parent
 * re-renders that pass a new stagesForProduct function reference
 * (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has stagesForProduct in deps → fires on new ref →
 *             setText('') and setSeverity('at-risk') wipe user input.
 * After fix:  stagesForProduct removed from deps → state preserved.
 */
describe("RiskEditDialog — A13/A15 form-race regression", () => {
  it("preserves typed text when parent re-renders with a new stagesForProduct ref", () => {
    const onSave = vi.fn();
    const stagesV1 = () => ["Dev", "Testing"] as const;

    const { rerender } = render(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV1}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "user typed this — must survive" },
    });
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue(
      "user typed this — must survive",
    );

    const stagesV2 = () => ["Dev", "Testing"] as const;
    rerender(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV2}
      />,
    );

    // A13 bug: before fix, text was wiped back to '' by useEffect firing on
    // the new stagesForProduct reference.
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue(
      "user typed this — must survive",
    );
  });

  it("preserves selected Blocked severity when parent re-renders with a new stagesForProduct ref", () => {
    const stagesV1 = () => ["Dev"] as const;

    const { rerender } = render(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV1}
      />,
    );

    // Select "✕ Blocked" severity (the user calls this "Blocker" — A15)
    fireEvent.click(screen.getByRole("button", { name: /Blocked/i }));
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const stagesV2 = () => ["Dev"] as const;
    rerender(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV2}
      />,
    );

    // A15 bug: before fix, severity was reset to 'at-risk' by the same useEffect.
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
