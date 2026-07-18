import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product, RiskEntry } from "../../report-sections";
import {
  LeadFormSyncBridge,
  type RiskPrefillRequest,
} from "./lead-form-sync-bridge";

// simplify-stage-status-interaction: clicking a risk-floored chip surfaces an
// info toast — mock sonner so the assertion doesn't need a mounted <Toaster>.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));
const { toast } = await import("sonner");

// The sonner mock is module-level, so its call history persists across tests;
// reset it before each so a toast.info assertion never reads a prior test's call.
beforeEach(() => {
  vi.clearAllMocks();
});

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
  // Mirror lead-form's quick-add "Blocker": a one-shot severity-blocked prefill
  // routed through the bridge's external channel. It lives in this PERSISTENT
  // parent while `bridgeKey` can remount the Provider (the slides<->edit toggle).
  const [blockerPrefill, setBlockerPrefill] =
    useState<RiskPrefillRequest | null>(null);
  const [bridgeKey, setBridgeKey] = useState(0);

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
      key={bridgeKey}
      products={products}
      risks={risks}
      readOnly={readOnly}
      {...(displayRisks ? { displayRisks } : {})}
      risksAddSignal={risksAddSignal}
      externalRiskPrefill={blockerPrefill}
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
        {!readOnly && (
          <button
            type="button"
            onClick={() =>
              setBlockerPrefill((prev) => ({
                signal: (prev?.signal ?? 0) + 1,
                productId: products[0]?.id ?? "",
                stageIds: [],
                severity: "blocked",
              }))
            }
          >
            Quick-add Blocker
          </button>
        )}
        <button type="button" onClick={() => setBridgeKey((k) => k + 1)}>
          Remount bridge
        </button>
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
    // Risk preview card surfaces the risk text (no inline textarea — editing
    // happens in RiskEditDialog; the main UI shows a read-only preview).
    expect(screen.getByText("pre-existing")).toBeInTheDocument();
  });

  it("Test 2c (quick-add Blocker): opens the risk dialog pre-set to severity blocked", async () => {
    // record-status-ux-polish §2: the external prefill routes a "Blocker"
    // through the create dialog pre-set to blocked, not the pipeline-derived
    // at-risk default (no stage is pipeline-flagged here).
    const user = userEvent.setup();
    const product = buildProduct();

    render(<Harness initialProducts={[product]} initialRisks={[]} />);

    await user.click(
      screen.getByRole("button", { name: /Quick-add Blocker/i }),
    );

    await screen.findByRole("dialog", { name: /Add Risk dialog/i });
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /At Risk/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("Test 2d (D16): a bridge remount does NOT reopen the dialog from a stale external prefill", async () => {
    // The external prefill lives in the persistent parent; the bridge remounts
    // on the slides<->edit toggle. A stale (already-consumed) prefill must not
    // reopen the create dialog on remount — mirrors the useEditableListDialog
    // D16 stale-signal guard.
    const user = userEvent.setup();
    const product = buildProduct();

    render(<Harness initialProducts={[product]} initialRisks={[]} />);

    await user.click(
      screen.getByRole("button", { name: /Quick-add Blocker/i }),
    );
    await screen.findByRole("dialog", { name: /Add Risk dialog/i });
    // Close it — the prefill (signal 1) stays set in the persistent parent.
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(
      screen.queryByRole("dialog", { name: /Add Risk dialog/i }),
    ).not.toBeInTheDocument();

    // Remount the bridge; the still-set prefill must NOT reopen the dialog.
    await user.click(screen.getByRole("button", { name: /Remount bridge/i }));
    expect(
      screen.queryByRole("dialog", { name: /Add Risk dialog/i }),
    ).not.toBeInTheDocument();

    // A genuine later quick-add still opens (guard advances on strict increase).
    await user.click(
      screen.getByRole("button", { name: /Quick-add Blocker/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /Add Risk dialog/i }),
    ).toBeInTheDocument();
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

    // Dialog renders with the existing risk text in a textbox (editing
    // happens here so impact/mitigation can be validated together).
    const textbox = await screen.findByDisplayValue("OAuth delay");
    expect(textbox).toBeInTheDocument();
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
    const devChip = screen.getByRole("button", { name: /^Dev: at-risk/ });
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

// rethink-pipeline-state-vs-completeness: saving a risk reflects up to the
// chip via the render-time floor (applyRiskSeverityFloor) — NOT by persisting a
// derived status onto the products. The old write-through (promote on add)
// corrupted completeness; these tests pin the display-only behavior plus the
// no-persisted-status contract.
describe("LeadFormSyncBridge — risk-derived chip severity (no persisted write-through)", () => {
  it("saving a Blocked risk renders the covered chip blocked WITHOUT persisting a status", async () => {
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

    // The Dev chip renders blocked via the render-time floor; Planning (locked)
    // and the uncovered Testing chip stay at their explicit on-track.
    expect(
      await screen.findByRole("button", { name: /^Dev: blocked/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Testing: on-track/ }),
    ).toBeInTheDocument();

    // No status was persisted onto the products — the chip severity is a pure
    // derivation of the covering risk, not a write-through.
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
  });

  it("locked-ownership stages are never derived from a risk", async () => {
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

    // Planning is locked-ownership — the floor never touches it, and nothing is
    // persisted onto the products.
    expect(
      await screen.findByRole("button", { name: /^Planning: on-track/ }),
    ).toBeInTheDocument();
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
  });

  it("BLOCKER regression: adding a product-wide risk does NOT inflate the completeness pill (wiring junction)", async () => {
    // rethink-pipeline-state-vs-completeness: the live wiring is
    // `products={flooredProducts}` + `rawProducts={ctx.products}`. The pill must
    // read RAW status, so a product-wide risk (the Add Risk dialog defaults all
    // stages checked) cannot flip empty owned stages to "filled". Pre-fix this
    // exact action drove the pill to "3/3 complete" and persisted across reload.
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "Lead",
        },
        {
          stageName: "Testing",
          status: "empty",
          ownership: "mine",
          assignee: "Lead",
        },
        {
          stageName: "Support",
          status: "empty",
          ownership: "mine",
          assignee: "Lead",
        },
      ],
    });

    const { container } = render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    // Baseline: 1 of 3 owned stages filled, incomplete.
    const pillBefore = container.querySelector<HTMLElement>("[data-complete]");
    expect(pillBefore?.textContent).toContain("1/3 Your stages");
    expect(pillBefore?.dataset.complete).toBe("false");

    // Add a product-wide risk: every owned stage checked by default.
    await user.click(screen.getByRole("button", { name: /\+ Add Risk/i }));
    await user.type(screen.getByLabelText(/^Risk \*/i), "Product-wide risk");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Broad impact");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Escalate");
    await user.click(screen.getByRole("button", { name: /Save Risk/i }));

    // The risk floors the empty chips for DISPLAY, but completeness reads raw —
    // so the pill is unchanged: still 1/3, still incomplete.
    const pillAfter = container.querySelector<HTMLElement>("[data-complete]");
    expect(pillAfter?.textContent).toContain("1/3 Your stages");
    expect(pillAfter?.dataset.complete).toBe("false");
    // No derived status was persisted onto the products.
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
  });

  it("W11/W6 reload regression: a raw-empty stage covered by an OWN risk renders floored, counts in X/7, and stays distinguishable from an explicit status", () => {
    // fix-report-surface-integrity W11 + W6 combined reload-stability. The inputs
    // here mirror the read model after a risk add WITHOUT a refetch: the raw Dev
    // stage persists `empty` and the risk arrives via state (initialRisks), with
    // no baked coveredByOwnRisk flag. The bridge re-derives coveredByOwnRisk and
    // re-applies the severity floor at render. The mapper-bake half of reload
    // (the flag arriving already set from the DB read) is proven in
    // lead-form.test.ts; together they cover both reload entry points. Three
    // guarantees in one place:
    //   1. render floored — the empty Dev chip shows the risk severity (blocked),
    //   2. counts in X/7 — coveredByOwnRisk ticks the pill 1/2 → 2/2,
    //   3. stays distinguishable — Dev reads "by risk" (covered), Testing reads
    //      "status set" (explicit), so the chip distinction survives the reload.
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "empty",
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
    const ownStagedRisk: RiskEntry = {
      id: "r-dev",
      productId: "crm",
      productName: "CRM Platform",
      stageIds: ["Dev"],
      severity: "blocked",
      text: "Dev environment down",
      impact: "Cannot ship",
      mitigation: "Escalate",
    };
    const { container } = render(
      <Harness initialProducts={[product]} initialRisks={[ownStagedRisk]} />,
    );

    // 2. Counts in X/7: the risk-covered empty stage ticks the completeness pill.
    const pill = container.querySelector<HTMLElement>("[data-complete]");
    expect(pill?.textContent).toContain("2/2 Your stages");
    expect(pill?.dataset.complete).toBe("true");

    // 1 + 3. The Dev chip renders floored (blocked) AND announces "by risk", so
    // it is visibly distinct from the explicitly-set Testing chip ("status set").
    expect(
      screen.getByRole("button", { name: "Dev: blocked by risk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Testing: on-track — status set" }),
    ).toBeInTheDocument();
  });

  it("W11: a covers-all (stageIds: []) risk does NOT tick the pill (root-cause guard)", () => {
    // The legacy "covers all" default is exactly the original defect; an empty
    // stageIds must never count an untouched stage. Dev stays uncounted → 1/2.
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "empty",
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
    const coversAllRisk: RiskEntry = {
      id: "r-all",
      productId: "crm",
      productName: "CRM Platform",
      stageIds: [],
      severity: "blocked",
      text: "Product-wide blocker",
      impact: "Broad",
      mitigation: "Escalate",
    };
    const { container } = render(
      <Harness initialProducts={[product]} initialRisks={[coversAllRisk]} />,
    );
    const pill = container.querySelector<HTMLElement>("[data-complete]");
    expect(pill?.textContent).toContain("1/2 Your stages");
    expect(pill?.dataset.complete).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// simplify-stage-status-interaction: severity floor (D3) + chip toggle (D1/D2)
// ---------------------------------------------------------------------------

describe("LeadFormSyncBridge — severity floor and chip toggle", () => {
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

  it("D3: a stale on-track chip renders at the covering risk's severity (floor)", () => {
    // Persisted explicit status says on-track; a non-empty covering blocked
    // risk forces the rendered chip to blocked without any state mutation.
    const product = buildProduct();
    const risk = coveringRisk({ severity: "blocked" });

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    expect(
      screen.getByRole("button", { name: /^Dev: blocked/ }),
    ).toBeInTheDocument();
    // Uncovered sibling stage stays at its explicit status.
    expect(
      screen.getByRole("button", { name: /^Testing: on-track/ }),
    ).toBeInTheDocument();
  });

  it("D3 (council find C): an orphan explicit blocked stage with no covering risk renders on-track on the live form", () => {
    // The read model already collapses an unbacked severity to on-track; the
    // live form must agree. A stage persisted blocked with NO covering risk
    // renders on-track (the migration for legacy explicit-severity rows).
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "blocked",
          ownership: "mine",
          assignee: "Lead",
        },
      ],
    });

    render(<Harness initialProducts={[product]} initialRisks={[]} />);

    expect(
      screen.getByRole("button", { name: /^Dev: on-track/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Dev: blocked/ }),
    ).not.toBeInTheDocument();
  });

  it("D1: clicking an uncovered empty chip toggles it to on-track", async () => {
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "empty",
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

    await user.click(screen.getByRole("button", { name: /^Dev: empty/ }));

    // The toggle applies straight through — no menu, no risk dialog.
    expect(
      screen.queryByRole("dialog", { name: /Add Risk dialog/i }),
    ).not.toBeInTheDocument();
    expect(onProductsChangeSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: /^Dev: on-track/ }),
    ).toBeInTheDocument();
  });

  it("D1/D2: clicking a risk-floored chip changes nothing and points at the Risks section", async () => {
    // Dev is persisted on-track but floored to blocked by a covering own risk.
    // The chip no longer authors or lowers severity — the click is a no-op with
    // an info hint; the lead must edit the risk to change the stage.
    const user = userEvent.setup();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct();
    const risk = coveringRisk({ severity: "blocked" });

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[risk]}
        onRisksChangeSpy={onRisksChangeSpy}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Dev: blocked/ }));

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringMatching(/covering risk/i),
    );
    expect(onRisksChangeSpy).not.toHaveBeenCalled();
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^Dev: blocked/ }),
    ).toBeInTheDocument();
  });

  it("D1/D2 (own-only): a foreign risk does NOT floor the mine chip, so its toggle still applies", async () => {
    // Only own risks floor the live chip. A foreign risk covering a mine stage
    // collapses the chip to on-track (find C) and lives in another lead's
    // section, so the toggle is not blocked — the lead sets their own status.
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "on-track",
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
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    // The mine chip shows the lead's own on-track (foreign risk never floors it).
    await user.click(screen.getByRole("button", { name: /^Dev: on-track/ }));

    // The toggle applies — no hint, no block.
    expect(toast.info).not.toHaveBeenCalled();
    expect(onProductsChangeSpy).toHaveBeenCalled();
  });
});
