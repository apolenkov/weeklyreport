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

describe("RiskEditDialog — compact touch floor", () => {
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

const a11yProps = {
  open: true,
  risk: null,
  products: products,
  defaultProductId: "p1",
  stagesForProduct: () => ["Dev"] as const,
  onSave: vi.fn(),
} as const;

describe("RiskEditDialog — backdrop dismissal and focus", () => {
  it("Escape on the backdrop calls onCancel", () => {
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

  it("Escape on the backdrop prevents the browser-native dismiss side effect", () => {
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

  it("Cancel button click calls onCancel", () => {
    const onCancel = vi.fn();
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop calls onCancel", () => {
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

  it("clicking the inner dialog does not call onCancel", () => {
    const onCancel = vi.fn();
    render(<RiskEditDialog {...a11yProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("dialog"));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("moves document focus to the risk textarea on mount", () => {
    render(<RiskEditDialog {...a11yProps} onCancel={vi.fn()} />);

    const textarea = document.getElementById("risk-text");
    expect(document.activeElement).toBe(textarea);
  });
});

// Typed text and selected severity must survive parent re-renders that pass a
// new stagesForProduct function reference (autosave → React Query invalidate).
describe("RiskEditDialog — form state across parent renders", () => {
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
    stageNames: ["Integration"],
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
// required-stage error. A row that already carries stageNames stays saveable.
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
    // the dead-end guard — no empty stageNames payload escapes.
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

  it("keeps Save enabled for a cross-stage edit that already carries stageNames (product returns [])", () => {
    const onSave = vi.fn();
    const crossStageRisk: RiskEntry = {
      id: "r-cross",
      productId: "p-foreign",
      productName: "Payments Gateway",
      stageNames: ["Integration"],
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
    // selection + Save sets errors.stageNames = "Select at least one stage.".
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

describe("RiskEditDialog — classification field order", () => {
  it("gives the severity choices their visible label as an accessible name", () => {
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

    expect(screen.getByRole("group", { name: "Severity" })).toBeInTheDocument();
  });

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

describe("RiskEditDialog — activity parenting", () => {
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
      stageNames?: string[];
    };
    expect(saved).toMatchObject({
      activityId: "act1",
      productId: "",
      text: "Vendor delay",
    });
    expect(saved.stageNames).toEqual([]);
  });
});
