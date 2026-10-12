// Stage selection is required for a product parent (empty = validation error);
// options come from the lead's StageAssignment rows via stagesForProduct.

import { fireEvent, render, screen } from "@testing-library/react";
import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { Product, RiskEntry } from "../../report-sections";
import { RiskEditDialog } from "./risk-edit-dialog";
import { collectRiskErrors } from "./risk-edit-dialog-helpers";

const products: Product[] = [
  {
    id: "p1",
    name: "CRM",
    overallStatus: "on-track",
    stages: [],
  },
];

describe("RiskEditDialog prose limits", () => {
  it.each(["text", "impact", "mitigation"] as const)(
    "validates the shared boundary for %s",
    (field) => {
      const base = {
        text: "Valid risk",
        impact: "Valid impact",
        mitigation: "Valid mitigation",
        isActivityParent: true,
        effectiveStageNames: [] as string[],
      };
      for (const [value, expected] of [
        ["", "required"],
        [" ".repeat(3), "required"],
        ["A", undefined],
        ["A".repeat(SAFE_TEXT_MAX_LENGTH), undefined],
        ["A".repeat(SAFE_TEXT_MAX_LENGTH + 1), "characters"],
      ] as const) {
        const errors = collectRiskErrors({ ...base, [field]: value });
        if (expected === undefined) expect(errors[field]).toBeUndefined();
        else expect(errors[field]).toContain(expected);
      }
    },
  );

  it("keeps and focuses over-limit pasted risk text without saving", () => {
    const onSave = vi.fn();
    const overLimit = `${"R".repeat(SAFE_TEXT_MAX_LENGTH)} `;
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
      target: { value: overLimit },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Impact" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Mitigation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save risk" }));

    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue(overLimit);
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      `Risk description must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`,
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("retains invisible-only risk text with an associated error and does not save", () => {
    const onSave = vi.fn();
    const invisibleOnly = "\u200B";
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

    const riskText = screen.getByLabelText(/^Risk \*/i);
    fireEvent.change(riskText, { target: { value: invisibleOnly } });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Impact" },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: "Mitigation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save risk" }));

    expect(riskText).toHaveValue(invisibleOnly);
    expect(riskText).toHaveAttribute("aria-invalid", "true");
    expect(riskText).toHaveAccessibleDescription(
      `1 / ${SAFE_TEXT_MAX_LENGTH} characters Risk description must contain visible text.`,
    );
    expect(riskText).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("RiskEditDialog — stale create parent", () => {
  it("blocks button and shortcut saves, then saves the explicitly selected product", () => {
    const onSave = vi.fn();
    const mixedProducts: Product[] = [
      ...products,
      {
        id: "p2",
        name: "Billing",
        overallStatus: "on-track",
        stages: [],
      },
    ];
    render(
      <RiskEditDialog
        open
        risk={null}
        products={mixedProducts}
        activities={[{ id: "a1", name: "Triage" }]}
        defaultProductId="stale-id"
        initialStageNames={["Dev"]}
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={() => undefined}
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

    const saveButton = screen.getByRole("button", { name: /Save risk/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);
    expect(onSave).not.toHaveBeenCalled();

    const backdrop = document.querySelector<HTMLElement>(
      '[role="presentation"]',
    );
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.keyDown(backdrop, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(backdrop, { key: "Enter", metaKey: true });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Parent"), {
      target: { value: "product:p2" },
    });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      productId: "p2",
      productName: "Billing",
      stageNames: ["Dev"],
    });
  });
});

describe("RiskEditDialog — compact touch floor", () => {
  it("keeps severity chips at the touch target across breakpoints", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // Dialog actions stay compact on desktop; interactive chips keep 44px.
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

    for (const name of [/^Cancel$/, /Save risk/]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[40px]");
    }

    for (const name of [/At risk$/, /Blocked$/]) {
      const chip = screen.getByRole("button", { name });
      expect(chip.className).toContain("min-h-[var(--touch-target-min)]");
      expect(chip.className).not.toContain("md:min-h-[34px]");
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
        stagesForProduct={(productId) =>
          productId === "p1" ? ["Dev", "Testing"] : []
        }
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save risk/i }));

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

    expect(screen.getByRole("button", { name: /Save risk/i })).toBeDisabled();
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
      screen.getByRole("button", { name: /Save risk/i }),
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
    fireEvent.click(screen.getByRole("button", { name: /Save risk/i }));

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
        stagesForProduct={(productId) => (productId === "p1" ? ["Dev"] : [])}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Save risk/i }),
    ).not.toBeDisabled();
    expect(
      screen.queryByText(/no stages assigned — contact admin/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save risk/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /Save risk/i }));
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
    expect(screen.getByRole("button", { name: /Save risk/i })).toBeDisabled();
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
    expect(
      screen.getByRole("group", { name: "Severity" }),
    ).toHaveAccessibleDescription(
      "At risk = needs attention; Blocked = work stopped.",
    );
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
    fireEvent.click(screen.getByRole("button", { name: /Save risk/i }));

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

describe("RiskEditDialog discard guard", () => {
  it("asks before discarding typed text on Escape and keeps it on Keep editing", () => {
    const onCancel = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={onCancel}
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"]}
      />,
    );
    const text = screen.getByLabelText(/^Risk \*/i);
    fireEvent.change(text, { target: { value: "Vendor delay" } });
    fireEvent.keyDown(text, { key: "Escape" });

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard changes?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue("Vendor delay");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("asks before discarding when only the severity changed", () => {
    const onCancel = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={onCancel}
        defaultProductId="p1"
        initialSeverity="at-risk"
        stagesForProduct={() => ["Dev"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Blocked" }));
    fireEvent.keyDown(screen.getByLabelText(/^Risk \*/i), { key: "Escape" });

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard changes?",
    );
    expect(onCancel).not.toHaveBeenCalled();
  });
});
