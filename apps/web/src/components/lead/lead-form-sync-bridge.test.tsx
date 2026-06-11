import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  LeadFormSyncBridge,
  promoteStageStatus,
} from "./lead-form-sync-bridge";
import type { Product, RiskEntry } from "./mock-data";

// unify-risk-stage-status (D3): the cross-author lowering block surfaces as
// a toast — mock sonner so the assertion doesn't need a mounted <Toaster>.
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));
const { toast } = await import("sonner");

function buildProduct(overrides?: Partial<Product>): Product {
  return {
    id: "crm",
    name: "CRM Platform",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Planning",
        status: "on-track",
        ownership: "locked",
        assignee: "PM",
      },
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "Тимлид 1",
      },
      {
        stageName: "Testing",
        status: "on-track",
        ownership: "mine",
        assignee: "Тимлид 1",
      },
    ],
    ...overrides,
  };
}

interface HarnessProps {
  initialProducts: Product[];
  initialRisks: RiskEntry[];
  readOnly?: boolean;
  /** W5: merged own + foreign risks (visual render + D3 foreign-coverage check). */
  displayRisks?: RiskEntry[];
  onProductsChangeSpy?: (next: Product[]) => void;
  onRisksChangeSpy?: (next: RiskEntry[]) => void;
}

function Harness({
  initialProducts,
  initialRisks,
  readOnly,
  displayRisks,
  onProductsChangeSpy,
  onRisksChangeSpy,
}: HarnessProps) {
  const [products, setProducts] = useState(initialProducts);
  const [risks, setRisks] = useState(initialRisks);
  const [risksAddSignal, setRisksAddSignal] = useState(0);

  // Mirror what lead-form.tsx does: derive owned stages per product so the
  // RiskEditDialog stage selector is populated in integration tests.
  function stagesForProduct(productId: string): readonly string[] {
    const product = products.find((p) => p.id === productId);
    return (product?.stages ?? [])
      .filter((s) => s.ownership === "mine")
      .map((s) => s.stageName);
  }

  return (
    <LeadFormSyncBridge.Provider
      products={products}
      risks={risks}
      readOnly={readOnly}
      {...(displayRisks ? { displayRisks } : {})}
      risksAddSignal={risksAddSignal}
      stagesForProduct={stagesForProduct}
      onProductsChange={(next) => {
        setProducts(next);
        onProductsChangeSpy?.(next);
      }}
      onRisksChange={(next) => {
        setRisks(next);
        onRisksChangeSpy?.(next);
      }}
    >
      <section>
        <h2>SDLC</h2>
        <LeadFormSyncBridge.Pipeline />
      </section>
      <section>
        <h2>Risks</h2>
        {!readOnly && (
          <button type="button" onClick={() => setRisksAddSignal((v) => v + 1)}>
            + Add Risk
          </button>
        )}
        <LeadFormSyncBridge.Risks />
      </section>
    </LeadFormSyncBridge.Provider>
  );
}

describe("LeadFormSyncBridge", () => {
  it("Test 1: renders Pipeline + Risks with the same data passed to the Provider", () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      text: "pre-existing",
      impact: "",
      mitigation: "",
    };

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    // Pipeline rendered with product name (appears in both pipeline header and risk card)
    expect(screen.getAllByText("CRM Platform").length).toBeGreaterThanOrEqual(
      1,
    );
    // Risk preview card surfaces the risk text (no inline textarea anymore — Phase 22+ moved
    // editing into RiskEditDialog; the main UI shows a read-only preview).
    expect(screen.getByText("pre-existing")).toBeInTheDocument();
  });

  it("Test 2 (D2): raising an uncovered chip does NOT apply — it opens the prefilled risk dialog instead", async () => {
    // unify-risk-stage-status: a chip click is never the only record of a
    // risk. Pre-D2 this test pinned the direct apply; now the click routes
    // through risk creation and the status stays unapplied.
    const user = userEvent.setup();
    const product = buildProduct();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        onProductsChangeSpy={onProductsChangeSpy}
        onRisksChangeSpy={onRisksChangeSpy}
      />,
    );

    // Open the stage popover for Dev (lead-owned, currently on-track)
    const devChip = screen.getByRole("button", { name: "Dev: on-track" });
    await user.click(devChip);

    // Pick "At Risk" from the popover (rendered as role="menuitem", not button)
    const atRiskOption = await screen.findByRole("menuitem", {
      name: /At Risk/i,
    });
    await user.click(atRiskOption);

    // The risk edit dialog opens in create mode, prefilled with the clicked
    // stage (checked) and the clicked severity (pressed).
    const dialog = await screen.findByRole("dialog", {
      name: /Add Risk dialog/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Dev" })).toBeChecked();
    expect(screen.getByRole("button", { name: /At Risk/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The status was never applied and no risk row exists yet.
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
    expect(onRisksChangeSpy).not.toHaveBeenCalled();

    // Cancel: the chip keeps its previous status — no rollback needed.
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Dev: on-track" }),
    ).toBeInTheDocument();
  });

  it("Test 2b (D2 save): saving the prefilled dialog creates the risk and raises the chip", async () => {
    const user = userEvent.setup();
    const product = buildProduct();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        onProductsChangeSpy={onProductsChangeSpy}
        onRisksChangeSpy={onRisksChangeSpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dev: on-track" }));
    await user.click(await screen.findByRole("menuitem", { name: /Blocked/i }));

    await screen.findByRole("dialog", { name: /Add Risk dialog/i });
    await user.type(screen.getByLabelText(/^Risk \*/i), "Vendor outage");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Work stopped");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Escalate");
    await user.click(screen.getByRole("button", { name: /Save Risk/i }));

    // Risk row created with the prefilled stage + severity.
    expect(onRisksChangeSpy).toHaveBeenCalled();
    const savedRisks = expectDefined(
      expectDefined(onRisksChangeSpy.mock.calls.at(-1))[0],
    );
    expect(savedRisks).toHaveLength(1);
    expect(expectDefined(savedRisks[0]).severity).toBe("blocked");
    expect(expectDefined(savedRisks[0]).stageIds).toEqual(["Dev"]);

    // Chip raised through the up-flow promotion (no extra confirmation).
    const lastProducts = expectDefined(
      expectDefined(onProductsChangeSpy.mock.calls.at(-1))[0],
    );
    const dev = expectDefined(lastProducts[0]).stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(dev?.status).toBe("blocked");
  });

  it("Test 3: clicking Edit on a risk opens the RiskEditDialog (edit surface for impact/mitigation)", async () => {
    const user = userEvent.setup();
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      text: "OAuth delay",
      impact: "",
      mitigation: "",
    };

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    // Click the Edit (pencil) button on the risk card → opens RiskEditDialog
    const editBtn = screen.getByRole("button", {
      name: /Edit risk for CRM Platform/i,
    });
    await user.click(editBtn);

    // Dialog renders with the existing risk text in a textbox (Phase 22+ moved
    // editing here so impact/mitigation can be validated together).
    const textbox = await screen.findByDisplayValue("OAuth delay");
    expect(textbox).toBeInTheDocument();
  });

  it("Test 5 (D3): mixed-case stageIds alias — clearing the 'Dev' chip routes through confirmed deletion of the ['dev'] risk", async () => {
    // Pre-D3 the chip itself confirmed "risks will stay"; now lowering a
    // covered chip deletes/strips the covering risks after confirmation.
    // The dev/Dev/Development canonicalization this test always pinned is
    // still the load-bearing part: the ['dev'] risk must count as covering.
    const user = userEvent.setup();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Planning",
          status: "on-track",
          ownership: "locked",
          assignee: "PM",
        },
        {
          stageName: "Dev",
          status: "blocked",
          ownership: "mine",
          assignee: "Тимлид 1",
        },
        {
          stageName: "Testing",
          status: "on-track",
          ownership: "mine",
          assignee: "Тимлид 1",
        },
      ],
    });
    // lowercase "dev" in stageIds — canonical alias of "Development" / "Dev"
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageIds: ["dev"],
      severity: "blocked",
      text: "API outage",
      impact: "",
      mitigation: "",
    };

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[risk]}
        onRisksChangeSpy={onRisksChangeSpy}
      />,
    );

    const devChip = screen.getByRole("button", { name: "Dev: blocked" });
    await user.click(devChip);

    const clearOption = await screen.findByRole("menuitem", { name: /Clear/i });
    await user.click(clearOption);

    // D3 confirmation enumerates the consequence: the single-stage covering
    // risk will be deleted ("Deletes 1 risk" proves the canonical match).
    expect(await screen.findByText(/Deletes 1 risk\./i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Lower status/i }));

    // Risk row deleted, chip cleared.
    expect(onRisksChangeSpy).toHaveBeenCalledWith([]);
    expect(
      screen.getByRole("button", { name: "Dev: empty" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("API outage")).not.toBeInTheDocument();
  });

  it("Test 4: when readOnly=true, stage chips are disabled and risks render as preview cards without edit/add controls", () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      text: "existing",
      impact: "",
      mitigation: "",
    };

    render(
      <Harness initialProducts={[product]} initialRisks={[risk]} readOnly />,
    );

    // Stage chip is non-interactive in readOnly mode (popover cannot open).
    // unify-risk-stage-status (D1): the non-empty covering risk floors the
    // rendered status to at-risk even on the read-only surface.
    const devChip = screen.getByRole("button", { name: "Dev: at-risk" });
    expect(devChip).toHaveAttribute("aria-disabled", "true");

    // Risk text rendered as plain preview, not a form control.
    expect(screen.getByText("existing")).toBeInTheDocument();

    // Edit / Delete / + Add Risk controls are hidden in read-only mode.
    expect(
      screen.queryByRole("button", { name: /Edit risk/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete risk/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\+ Add Risk/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 3.5: promoteStageStatus pure function + up-flow integration
// ---------------------------------------------------------------------------

describe("promoteStageStatus pure function", () => {
  it.each([
    ["on-track", "blocked", "blocked"],
    ["on-track", "at-risk", "at-risk"],
    ["at-risk", "blocked", "blocked"],
    ["at-risk", "at-risk", "at-risk"],
    ["blocked", "at-risk", "blocked"],
    ["blocked", "blocked", "blocked"],
  ] as const)(
    "current=%s + riskSeverity=%s → %s",
    (current, riskSeverity, expected) => {
      expect(promoteStageStatus(current, riskSeverity)).toBe(expected);
    },
  );
});

describe("LeadFormSyncBridge — up-flow stage promotion", () => {
  it("saving a risk with severity=Blocked promotes the pipeline stage from on-track to Blocked", async () => {
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Planning",
          status: "on-track",
          ownership: "locked",
          assignee: "PM",
        },
        {
          stageName: "Dev",
          status: "on-track",
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
    });

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    // Open the Add Risk dialog.
    const addBtn = screen.getByRole("button", { name: /\+ Add Risk/i });
    await user.click(addBtn);

    // Select Blocked severity, fill required fields, select Dev stage.
    const blockedBtn = await screen.findByRole("button", { name: /Blocked/i });
    await user.click(blockedBtn);

    await user.type(screen.getByLabelText(/^Risk \*/i), "Infra outage");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Work stopped");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Escalate");

    // Dev is not pre-selected (no pipeline flags). Click it.
    const devCheckbox = screen.getByRole("checkbox", { name: "Dev" });
    await user.click(devCheckbox);

    await user.click(screen.getByRole("button", { name: /Save Risk/i }));

    // Dev stage should be promoted to blocked; Planning (locked) unchanged.
    expect(onProductsChangeSpy).toHaveBeenCalled();
    const lastCall = onProductsChangeSpy.mock.calls.at(-1)?.[0];
    const dev = lastCall?.[0]?.stages.find((s) => s.stageName === "Dev");
    const planning = lastCall?.[0]?.stages.find(
      (s) => s.stageName === "Planning",
    );
    expect(dev?.status).toBe("blocked");
    expect(planning?.status).toBe("on-track"); // locked → never promoted
  });

  it("locked-ownership stages are NOT promoted when a risk is saved", async () => {
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Planning",
          status: "on-track",
          ownership: "locked",
          assignee: "PM",
        },
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "Lead",
        },
      ],
    });

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    const addBtn = screen.getByRole("button", { name: /\+ Add Risk/i });
    await user.click(addBtn);

    await user.type(screen.getByLabelText(/^Risk \*/i), "Risk");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Impact");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Mitigation");

    // Dev is the only mine-owned stage — computeInitialStageIds auto-selects it.
    // StageMultiSelect renders "Applied automatically" (non-interactive) for
    // a single stage, so there is no checkbox to click.

    await user.click(screen.getByRole("button", { name: /Save Risk/i }));

    // Find the most recent products update.
    const lastCall = onProductsChangeSpy.mock.calls.at(-1)?.[0];
    const planning = lastCall?.[0]?.stages.find(
      (s) => s.stageName === "Planning",
    );
    // Planning is locked-ownership — must remain on-track regardless.
    expect(planning?.status).toBe("on-track");
  });
});

// ---------------------------------------------------------------------------
// unify-risk-stage-status: severity floor (D1) + confirmed lowering (D3)
// ---------------------------------------------------------------------------

describe("LeadFormSyncBridge — severity floor and confirmed lowering", () => {
  const coveringRisk = (overrides?: Partial<RiskEntry>): RiskEntry => ({
    id: "r-dev",
    productId: "crm",
    productName: "CRM Platform",
    stageIds: ["Dev"],
    severity: "at-risk",
    text: "OAuth regression",
    impact: "Delay",
    mitigation: "Escalate",
    ...overrides,
  });

  it("D1: a stale on-track chip renders at the covering risk's severity (floor)", () => {
    // Persisted explicit status says on-track; a non-empty covering blocked
    // risk forces the rendered chip to blocked without any state mutation.
    const product = buildProduct();
    const risk = coveringRisk({ severity: "blocked" });

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    expect(
      screen.getByRole("button", { name: "Dev: blocked" }),
    ).toBeInTheDocument();
    // Uncovered sibling stage stays at its explicit status.
    expect(
      screen.getByRole("button", { name: "Testing: on-track" }),
    ).toBeInTheDocument();
  });

  it("D3 cancel: cancelling the lowering confirmation changes nothing", async () => {
    const user = userEvent.setup();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "at-risk",
          ownership: "mine",
          assignee: "Lead",
        },
      ],
    });

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[coveringRisk()]}
        onRisksChangeSpy={onRisksChangeSpy}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dev: at-risk" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /On Track/i }),
    );

    expect(await screen.findByText(/Deletes 1 risk\./i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));

    // Chip keeps its status; risk rows untouched.
    expect(onRisksChangeSpy).not.toHaveBeenCalled();
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Dev: at-risk" }),
    ).toBeInTheDocument();
    expect(screen.getByText("OAuth regression")).toBeInTheDocument();
  });

  it("D3 strip: a multi-stage risk survives with the clicked stage removed; the sibling chip keeps its floor", async () => {
    const user = userEvent.setup();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "at-risk",
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
    });
    const risk = coveringRisk({ stageIds: ["Dev", "Testing"] });

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[risk]}
        onRisksChangeSpy={onRisksChangeSpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dev: at-risk" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /On Track/i }),
    );

    expect(
      await screen.findByText(/Removes this stage from 1 risk\./i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Lower status/i }));

    // The risk row survives with only the sibling stage.
    const nextRisks = expectDefined(
      expectDefined(onRisksChangeSpy.mock.calls.at(-1))[0],
    );
    expect(nextRisks).toHaveLength(1);
    expect(expectDefined(nextRisks[0]).stageIds).toEqual(["Testing"]);

    // Clicked chip lowered; sibling chip keeps its severity floor.
    expect(
      screen.getByRole("button", { name: "Dev: on-track" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Testing: at-risk" }),
    ).toBeInTheDocument();
  });

  it("D3 cross-author block: lowering a chip covered by a foreign risk is rejected with a message", async () => {
    const user = userEvent.setup();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "at-risk",
          ownership: "mine",
          assignee: "Lead",
        },
      ],
    });
    const foreignRisk = coveringRisk({
      id: "r-foreign",
      foreign: true,
      authorName: "Other Lead",
    });

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        displayRisks={[foreignRisk]}
        onRisksChangeSpy={onRisksChangeSpy}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dev: at-risk" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /On Track/i }),
    );

    // No confirmation dialog, no mutation — just the explanatory toast.
    expect(screen.queryByText(/Deletes/i)).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/another lead's risk/i),
    );
    expect(onRisksChangeSpy).not.toHaveBeenCalled();
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Dev: at-risk" }),
    ).toBeInTheDocument();
  });
});
