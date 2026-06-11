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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Product, RiskEntry } from "./mock-data";
import { RiskEditDialog } from "./risk-edit-dialog";

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

  it("does NOT pre-select stages on create even when pipeline has flagged ones", () => {
    const onSave = vi.fn();
    const productsWithRiskyStage: Product[] = [
      {
        id: "p1",
        name: "CRM",
        overallStatus: "at-risk",
        stages: [
          {
            stageName: "Dev",
            status: "blocked",
            ownership: "mine",
            assignee: "Lead",
          },
          {
            stageName: "Testing",
            status: "on-track",
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
        products={productsWithRiskyStage}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    // Phase 3.8: stage checkboxes start empty on create regardless of pipeline flags.
    expect(screen.getByRole("checkbox", { name: "Dev" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));
    // Required stage validation fires since no stages are selected.
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- parentElement + textContent are nullable in the DOM assertion
      cb.parentElement?.textContent?.trim(),
    );
    expect(labels).toEqual(["Testing", "Support"]);
  });

  it("does NOT pre-select stages on create when pipeline uses alias (Dev → Development)", () => {
    const productsWithAlias: Product[] = [
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
          {
            stageName: "Testing",
            status: "on-track",
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
        products={productsWithAlias}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    // Phase 3.8: stage checkboxes start empty on create regardless of pipeline aliases.
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();
  });

  it("renders context strip showing pre-selected stages from pipeline", () => {
    const productsWithFlags: Product[] = [
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
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    // The context strip text contains both product name and stage/severity info.
    expect(
      screen.getByText(/Already flagged in SDLC pipeline/i),
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
    expect(screen.getByRole("button", { name: /At Risk/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
    const grid = document.querySelector('[class*="md:grid-cols-"]');
    expect(grid).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// VA-0a — a11y regression catalog (high-priority unit-rtl rows)
// Source: openspec/changes/verify-a11y-recommended-flip/design.md
// Section: apps/web/src/components/lead/risk-edit-dialog.tsx
// Rows: backdrop onKeyDown Escape, Cancel button, stopPropagation, autoFocus
// ---------------------------------------------------------------------------

const a11yProps = {
  open: true,
  risk: null,
  products: products,
  defaultProductId: "p1",
  stagesForProduct: () => ["Dev"] as const,
  onSave: vi.fn(),
} as const;

describe("RiskEditDialog — VA-0a a11y (backdrop onKeyDown + click behavior)", () => {
  it("Escape on the backdrop div calls onCancel (noStaticElementInteractions justification)", () => {
    const onCancel = vi.fn();
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.keyDown(backdrop, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape on the backdrop div calls e.preventDefault() (no browser-native dismiss side-effect)", () => {
    const onCancel = vi.fn();
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

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
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop div calls onCancel (click-to-close path)", () => {
    const onCancel = vi.fn();
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    expect(backdrop).not.toBeNull();
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking the inner dialog div does NOT call onCancel (stopPropagation guard, useKeyWithClickEvents justification)", () => {
    const onCancel = vi.fn();
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("dialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("textarea#risk-text receives document focus on mount (noAutofocus justification)", () => {
    render(<RiskEditDialog {...a11yProps} onCancel={vi.fn()} />);

    const textarea = document.getElementById("risk-text");
    expect(document.activeElement).toBe(textarea);
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

/**
 * fix-lead-surface-name-resolution: a risk row may reference a project
 * outside the lead's stage-owned `products` (cross-stage row). Saving the
 * edit dialog must preserve the original product assignment instead of
 * silently reassigning to the first stage-owned product, and the dialog
 * header must show the original product name.
 */
describe("RiskEditDialog — cross-stage product preservation", () => {
  const crossStageRisk: RiskEntry = {
    id: "r-cross",
    productId: "p-foreign",
    productName: "Payments Gateway",
    stageIds: ["Integration"],
    severity: "at-risk",
    text: "Gateway certification slips",
    impact: "Payments blocked",
    mitigation: "Escalate to vendor",
  };

  it("keeps the original product on save when its id is outside the stage-owned list", () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={crossStageRisk}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        initialImpact="Payments blocked"
        initialMitigation="Escalate to vendor"
        stagesForProduct={(productId) =>
          productId === "p1" ? ["Dev", "Testing"] : []
        }
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      productId: "p-foreign",
      productName: "Payments Gateway",
    });
  });

  it("shows the original product name in the dialog header", () => {
    render(
      <RiskEditDialog
        open
        risk={crossStageRisk}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        stagesForProduct={() => []}
      />,
    );

    expect(screen.getByText(/— Payments Gateway/)).toBeInTheDocument();
  });
});
