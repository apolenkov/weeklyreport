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

type HarnessProps = {
  initialProducts: Product[];
  initialRisks: RiskEntry[];
  readOnly?: boolean;
  onProductsChangeSpy?: (next: Product[]) => void;
  onRisksChangeSpy?: (next: RiskEntry[]) => void;
};

function Harness({
  initialProducts,
  initialRisks,
  readOnly,
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

  it("Test 2: clicking stage chip from on-track to at-risk fires onProductsChange (status sync via popover)", async () => {
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

    expect(onProductsChangeSpy).toHaveBeenCalled();
    const lastProductsCall = expectDefined(
      expectDefined(onProductsChangeSpy.mock.calls.at(-1))[0],
    );
    const dev = expectDefined(lastProductsCall[0]).stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(dev?.status).toBe("at-risk");
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

  it("Test 5: mixed-case stageIds alias — risk with stageIds ['dev'] counts toward the 'Dev' stage chip", async () => {
    const user = userEvent.setup();
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

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    const devChip = screen.getByRole("button", { name: "Dev: blocked" });
    await user.click(devChip);

    const clearOption = await screen.findByRole("menuitem", { name: /Clear/i });
    await user.click(clearOption);

    // Confirmation dialog appears only when linkedRiskCount > 0.
    // "1 linked risk" proves canonicalization: stageIds["dev"] → "Development" → matches "Dev".
    expect(await screen.findByText(/1 linked risk/i)).toBeInTheDocument();
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
    const devChip = screen.getByRole("button", { name: "Dev: on-track" });
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
