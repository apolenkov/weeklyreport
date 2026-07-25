// Stage selection is required for a product parent (empty = validation error);
// options come from the lead's StageAssignment rows via stagesForProduct.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Product, RiskEntry } from "../../report-sections";
import { RiskEditDialog } from "./risk-edit-dialog";

const products: Product[] = [
  {
    id: "p1",
    name: "CRM",
    overallStatus: "on-track",
    stages: [],
  },
];

describe("RiskEditDialog — compact touch floor (responsive-compact-layout)", () => {
  it("footer actions and severity chips floor at the touch target below md", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // Desktop density is untouched (md:min-h restores the 40px/34px values).
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );

    for (const name of [/^Cancel$/, /Save Risk/]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[40px]");
    }

    for (const name of [/At Risk$/, /Blocked$/]) {
      const chip = screen.getByRole("button", { name });
      expect(chip.className).toContain("min-h-[var(--touch-target-min)]");
      expect(chip.className).toContain("md:min-h-[34px]");
    }
  });
});

describe("RiskEditDialog - SDLC stage selector", () => {
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

    // Stage checkboxes start empty on create regardless of pipeline flags.
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
    // stage-label-canonicalization 1.2: the selected "Dev" option persists as
    // the canonical "Development".
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageIds: ["Development"],
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

  it("switching product clears the stage selection, never selects all owned stages", () => {
    // setProductAndStages must NOT default to every owned stage on a product
    // switch — that "covers all" default is the root cause of the
    // inflated-completeness defect. After switching, the lead marks stages
    // explicitly, so all checkboxes start unchecked.
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
          id === "p2" ? ["Dev", "Testing"] : ["Planning"]
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

    // Stage checkboxes start empty on create regardless of pipeline aliases.
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
        stagesForProduct={() => ["Dev", "Testing"]}
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
    expect(screen.getByRole("checkbox", { name: "Dev" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Product/i)).toBeInTheDocument();
  });
});

const a11yProps = {
  open: true,
  risk: null,
  products: products,
  defaultProductId: "p1",
  stagesForProduct: () => ["Dev"] as const,
  onSave: vi.fn(),
} as const;

describe("RiskEditDialog — backdrop keydown/click a11y", () => {
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

// Typed text and selected severity must survive parent re-renders that pass a
// new stagesForProduct function reference (autosave → React Query invalidate).
describe("RiskEditDialog — form-race regression", () => {
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

    // Select "✕ Blocked" severity (the user calls this "Blocker")
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

    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

// A cross-stage row references a project outside the lead's stage-owned
// `products`: saving must preserve it rather than reassign to the first one.
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

// The closed dialog returns null and remounts fresh content on reopen, so
// typed-but-cancelled state never leaks into the next open.
describe("RiskEditDialog — reopen renders fresh state", () => {
  it("does not leak typed text from a cancelled create into the next open", () => {
    const { rerender } = render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "draft that should be discarded" },
    });
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue(
      "draft that should be discarded",
    );

    // Cancel = close → the shell unmounts the content.
    rerender(
      <RiskEditDialog
        open={false}
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );
    expect(screen.queryByLabelText(/^Risk \*/i)).not.toBeInTheDocument();

    // Reopen → fresh mount, empty field.
    rerender(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue("");
  });
});

// Zero owned stages plus no stage on the row is a dead end: nothing is
// pickable, so Save is disabled and contact-admin replaces the unsatisfiable
// required-stage error. A row that already carries stageIds stays saveable.
describe("RiskEditDialog — zero-owned-stage guard", () => {
  it("disables Save and shows contact-admin (never the required-stage error) on a stage-less product", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => []}
      />,
    );

    expect(screen.getByRole("button", { name: /Save Risk/i })).toBeDisabled();
    expect(
      screen.getByText(/no stages assigned — contact admin/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Select at least one stage/i),
    ).not.toBeInTheDocument();
  });

  it("does NOT call onSave when the disabled-Save state is bypassed via Ctrl+Enter on a stage-less product", () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => []}
      />,
    );

    // Fill the prose fields so only the stage guard can block the save.
    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: "Vendor delay" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Slips Q3" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Escalate" },
    });

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.keyDown(backdrop, { key: "Enter", ctrlKey: true });

    // The keyboard shortcut routes through handleSave, which early-returns on
    // the dead-end guard — no empty stageIds payload escapes.
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/no stages assigned — contact admin/i),
    ).toBeInTheDocument();
  });

  it("still saves on a one-owned-stage product (single stage auto-applies)", () => {
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

    expect(
      screen.getByRole("button", { name: /Save Risk/i }),
    ).not.toBeDisabled();

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

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps Save enabled for a cross-stage edit that already carries stageIds (product returns [])", () => {
    const onSave = vi.fn();
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

    render(
      <RiskEditDialog
        open
        risk={crossStageRisk}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        initialImpact="Payments blocked"
        initialMitigation="Escalate to vendor"
        stagesForProduct={(productId) => (productId === "p1" ? ["Dev"] : [])}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Save Risk/i }),
    ).not.toBeDisabled();
    expect(
      screen.queryByText(/no stages assigned — contact admin/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      productId: "p-foreign",
      productName: "Payments Gateway",
    });
  });

  it("shows ONLY contact-admin (never the stale required-stage error) after a prior required-stage error then a switch to a zero-owned product", () => {
    const twoProducts: Product[] = [
      { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
      { id: "p2", name: "Billing", overallStatus: "on-track", stages: [] },
    ];
    render(
      <RiskEditDialog
        open
        risk={null}
        products={twoProducts}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={(id) => (id === "p1" ? ["Dev", "Testing"] : [])}
      />,
    );

    // Trigger the required-stage error on the multi-stage product: empty
    // selection + Save sets errors.stageIds = "Select at least one stage.".
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
    expect(screen.getByText(/Select at least one stage/i)).toBeInTheDocument();

    // Switch to the zero-owned-stage product: the stale required-stage error
    // must NOT co-render with the contact-admin dead-end message.
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "product:p2" },
    });

    expect(
      screen.getByText(/no stages assigned — contact admin/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Select at least one stage/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Risk/i })).toBeDisabled();
  });
});

describe("RiskEditDialog — classification field order (unify-record-dialogs)", () => {
  it("orders the classification panel Product → Stages → Severity", () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Development", "Testing"]}
      />,
    );

    const product = screen.getByLabelText("Product");
    const stages = screen.getByText("SDLC Stages");
    const severity = screen.getByText("Severity");

    // The spec requires the same control order across all three dialogs
    // (item/decision render Product → Stages → Status). A node FOLLOWS another
    // when DOCUMENT_POSITION_FOLLOWING is set in compareDocumentPosition.
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(product.compareDocumentPosition(stages) & FOLLOWING).toBeTruthy();
    expect(stages.compareDocumentPosition(severity) & FOLLOWING).toBeTruthy();
  });
});

describe("RiskEditDialog — activity parenting (activity-first-class)", () => {
  const oneProduct: Product[] = [
    { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
  ];
  const activities = [{ id: "act1", name: "Jira triage duty" }];

  it("hides the stage step and saves an activity-parented risk with no stage", () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={oneProduct}
        activities={activities}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
      />,
    );

    // A product parent shows the stage step.
    expect(screen.getByText(/SDLC Stages/i)).toBeInTheDocument();

    // Switch the parent to the activity — the stage step disappears.
    fireEvent.change(screen.getByLabelText("Parent"), {
      target: { value: "activity:act1" },
    });
    expect(screen.queryByText(/SDLC Stages/i)).toBeNull();

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

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]?.[0] as {
      activityId?: string | null;
      productId: string;
      text: string;
      stageIds?: string[];
    };
    expect(saved).toMatchObject({
      activityId: "act1",
      productId: "",
      text: "Vendor delay",
    });
    expect(saved.stageIds).toEqual([]);
  });
});
