import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { reportSectionReadModelSchema } from "@weeklyreport/shared";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product, RiskEntry } from "../../../../report-sections";
import { makeDraftMergeSection } from "../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import { InMemoryLeadFormWriteAdapter } from "../../../../report-sections/model/lead-form/lead-form-write-port.in-memory";
import { useLeadFormDraft } from "../../../../report-sections/model/lead-form/use-lead-form-draft";
import { useLeadFormQuickAdd } from "../../../../report-sections/model/lead-form/use-lead-form-quick-add";
import { mapLeadProducts } from "../../../../report-sections/model/lead-form-periods-products";
import { mapLeadRisks } from "../../../../report-sections/model/lead-form-risks";
import { buildDraftActions } from "../chrome/lead-form-draft-actions";
import { useLeadFormAddSignals } from "../chrome/use-lead-form-add-signals";
import {
  LeadFormSyncBridge,
  type RiskPrefillRequest,
} from "./lead-form-sync-bridge";

// Clicking a risk-floored chip surfaces an info toast — mock sonner so the
// assertion doesn't need a mounted <Toaster>.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));
const { toast } = await import("sonner");

// The sonner mock is module-level, so its call history persists across tests;
// reset it before each so a toast.info assertion never reads a prior test's call.
beforeEach(() => {
  vi.clearAllMocks();
});

it("preserves both public pipeline edits in one React batch through the latest raw draft", () => {
  const initial = makeDraftMergeSection();
  const section = reportSectionReadModelSchema.parse({
    ...initial,
    risks: initial.risks.map((risk) => ({
      ...risk,
      severity: "blocked",
      stageNames: ["Analysis"],
    })),
    projects: initial.projects.map((project) => ({
      ...project,
      trafficLight: "yellow",
      stageSet: [
        ...project.stageSet,
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac",
          stageName: "Analysis",
          sortOrder: 3,
        },
      ],
      ownedStages: [
        ...project.ownedStages.map((stage) => ({ ...stage, status: null })),
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac",
          stageName: "Analysis",
          sortOrder: 3,
          status: "yellow",
        },
      ],
    })),
  });
  const writePort = new InMemoryLeadFormWriteAdapter({
    saveDraft: () => Promise.resolve(section),
    submit: () => Promise.resolve(section),
  });

  function DraftPipeline() {
    const draft = useLeadFormDraft({
      generation: `${section.reportId}:${section.reportSectionId}`,
      serverSection: section,
      sectionIdForActions: section.reportSectionId,
      serverReadOnly: false,
      refetchSection: () => Promise.resolve(),
      crossAuthors: [],
      isEveryone: false,
      writePort,
    });
    const products = draft.draft ? mapLeadProducts(draft.draft) : [];
    const risks = draft.draft ? mapLeadRisks(draft.draft) : [];
    const quickAdd = useLeadFormQuickAdd({
      apply: draft.apply,
      generation: draft.generation,
      loaded: { products, currentWeekItems: [], nextWeekItems: [] },
    });
    const signals = useLeadFormAddSignals();
    const actions = buildDraftActions(
      { ...draft, ...quickAdd },
      signals,
      {
        products,
      },
      section,
    );
    return (
      <LeadFormSyncBridge.Provider
        products={products}
        risks={risks}
        onProductsChange={actions.onProductsChange}
        onRisksChange={actions.onRisksChange}
      >
        <output data-testid="raw-draft">{JSON.stringify(draft.draft)}</output>
        <LeadFormSyncBridge.Pipeline />
      </LeadFormSyncBridge.Provider>
    );
  }

  render(<DraftPipeline />);
  const development = screen.getByRole("button", { name: /^Development:/ });
  const testing = screen.getByRole("button", { name: /^Testing:/ });
  expect(
    screen.getByRole("button", { name: /^Analysis: Blocked/ }),
  ).toBeInTheDocument();
  act(() => {
    fireEvent.click(development);
    fireEvent.click(testing);
  });
  const current = reportSectionReadModelSchema.parse(
    JSON.parse(screen.getByTestId("raw-draft").textContent),
  );
  expect(current.projects[0]?.ownedStages.map((stage) => stage.status)).toEqual(
    ["green", "green", "yellow"],
  );
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
  // Includes foreign risks so the render and coverage paths are exercised.
  displayRisks?: RiskEntry[];
  onProductsChangeSpy?: (next: readonly Product[]) => void;
  onRisksChangeSpy?: (next: readonly RiskEntry[]) => void;
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
        setProducts((previous) => {
          const resolved = typeof next === "function" ? next(previous) : next;
          onProductsChangeSpy?.(resolved);
          return [...resolved];
        });
      }}
      onRisksChange={(next) => {
        setRisks([...next]);
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
            + Add risk
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() =>
              setBlockerPrefill((prev) => ({
                signal: (prev?.signal ?? 0) + 1,
                productId: products[0]?.id ?? "",
                stageNames: [],
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
  it("renders Pipeline + Risks with the same data passed to the Provider", () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageNames: ["Dev"],
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

  it("quick-add Blocker: opens the risk dialog pre-set to severity blocked", async () => {
    // The external prefill routes a "Blocker" through the create dialog
    // pre-set to blocked, not the pipeline-derived at-risk default (no
    // stage is pipeline-flagged here).
    const user = userEvent.setup();
    const product = buildProduct();

    render(<Harness initialProducts={[product]} initialRisks={[]} />);

    await user.click(
      screen.getByRole("button", { name: /Quick-add Blocker/i }),
    );

    await screen.findByRole("dialog", { name: /^Add risk/ });
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /At Risk/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("a bridge remount does NOT reopen the dialog from a stale external prefill", async () => {
    // The external prefill lives in the persistent parent; the bridge remounts
    // on the slides<->edit toggle. A stale (already-consumed) prefill must not
    // reopen the create dialog on remount — mirrors the useEditableListDialog
    // stale-signal guard.
    const user = userEvent.setup();
    const product = buildProduct();

    render(<Harness initialProducts={[product]} initialRisks={[]} />);

    await user.click(
      screen.getByRole("button", { name: /Quick-add Blocker/i }),
    );
    await screen.findByRole("dialog", { name: /^Add risk/ });
    // The prefill (signal 1) stays set in the persistent parent.
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(
      screen.queryByRole("dialog", { name: /^Add risk/ }),
    ).not.toBeInTheDocument();

    // Remount the bridge; the still-set prefill must NOT reopen the dialog.
    await user.click(screen.getByRole("button", { name: /Remount bridge/i }));
    expect(
      screen.queryByRole("dialog", { name: /^Add risk/ }),
    ).not.toBeInTheDocument();

    // A genuine later quick-add still opens (guard advances on strict increase).
    await user.click(
      screen.getByRole("button", { name: /Quick-add Blocker/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /^Add risk/ }),
    ).toBeInTheDocument();
  });

  it("clicking Edit on a risk opens the RiskEditDialog (edit surface for impact/mitigation)", async () => {
    const user = userEvent.setup();
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageNames: ["Dev"],
      severity: "at-risk",
      text: "OAuth delay",
      impact: "",
      mitigation: "",
    };

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    const editBtn = screen.getByRole("button", {
      name: /Edit risk for CRM Platform/i,
    });
    await user.click(editBtn);

    // Dialog renders with the existing risk text in a textbox (editing
    // happens here so impact/mitigation can be validated together).
    const textbox = await screen.findByDisplayValue("OAuth delay");
    expect(textbox).toBeInTheDocument();
  });

  it("when readOnly=true, stage chips are static and risks render as preview cards without edit/add controls", () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageNames: ["Dev"],
      severity: "at-risk",
      text: "existing",
      impact: "",
      mitigation: "",
    };

    render(
      <Harness initialProducts={[product]} initialRisks={[risk]} readOnly />,
    );

    // Stage chip is non-interactive in readOnly mode (popover cannot open).
    // The non-empty covering risk floors the rendered status to at-risk even
    // on the read-only surface.
    const devChip = screen.getByRole("img", {
      name: "Dev: At risk by risk — read-only status view",
    });
    expect(devChip).not.toHaveAttribute("tabindex");
    expect(devChip).not.toHaveAttribute("aria-disabled");
    expect(
      screen.queryByRole("button", { name: /^Dev: At risk/ }),
    ).not.toBeInTheDocument();

    // Risk text rendered as plain preview, not a form control.
    expect(screen.getByText("existing")).toBeInTheDocument();

    // Edit / Delete / + Add risk controls are hidden in read-only mode.
    expect(
      screen.queryByRole("button", { name: /Edit risk/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete risk/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\+ Add risk/i }),
    ).not.toBeInTheDocument();
  });
});

// Risk severity is display-only via applyRiskSeverityFloor — never persisted.
describe("LeadFormSyncBridge — risk-derived chip severity (no persisted write-through)", () => {
  it("saving a Blocked risk renders the covered chip blocked WITHOUT persisting a status", async () => {
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: readonly Product[]) => void>();
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

    const addBtn = screen.getByRole("button", { name: /\+ Add risk/i });
    await user.click(addBtn);

    const blockedBtn = await screen.findByRole("button", { name: /Blocked/i });
    await user.click(blockedBtn);

    await user.type(screen.getByLabelText(/^Risk \*/i), "Infra outage");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Work stopped");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Escalate");

    // Dev is not pre-selected (no pipeline flags). Click it.
    const devCheckbox = screen.getByRole("checkbox", { name: "Dev" });
    await user.click(devCheckbox);

    await user.click(screen.getByRole("button", { name: /Save risk/i }));

    // The Dev chip renders blocked via the render-time floor; Planning (locked)
    // and the uncovered Testing chip stay at their explicit on-track.
    expect(
      await screen.findByRole("button", { name: /^Dev: Blocked/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Testing: On track/ }),
    ).toBeInTheDocument();

    // No status was persisted onto the products — the chip severity is a pure
    // derivation of the covering risk, not a write-through.
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
  });

  it("locked-ownership stages are never derived from a risk", async () => {
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: readonly Product[]) => void>();
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

    const addBtn = screen.getByRole("button", { name: /\+ Add risk/i });
    await user.click(addBtn);

    await user.type(screen.getByLabelText(/^Risk \*/i), "Risk");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Impact");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Mitigation");

    // Dev is the only mine-owned stage — computeInitialStageNames auto-selects it.
    // StageMultiSelect renders "Applied automatically" (non-interactive) for
    // a single stage, so there is no checkbox to click.

    await user.click(screen.getByRole("button", { name: /Save risk/i }));

    // Planning is locked-ownership — the floor never touches it, and nothing is
    // persisted onto the products.
    const planningChip = await screen.findByRole("img", {
      name: "Planning: On track — locked; owned by PM. You don't have edit permissions",
    });
    expect(planningChip).not.toHaveAttribute("tabindex");
    expect(planningChip).not.toHaveAttribute("aria-disabled");
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
  });

  it("BLOCKER regression: adding a product-wide risk does NOT inflate the completeness pill (wiring junction)", async () => {
    // The live wiring is `products={flooredProducts}` +
    // `rawProducts={ctx.products}`. The pill must read RAW status, so a
    // product-wide risk (the Add risk dialog defaults all stages checked)
    // cannot flip empty owned stages to "filled".
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: readonly Product[]) => void>();
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
    await user.click(screen.getByRole("button", { name: /\+ Add risk/i }));
    await user.type(screen.getByLabelText(/^Risk \*/i), "Product-wide risk");
    await user.type(screen.getByLabelText(/^Impact \*/i), "Broad impact");
    await user.type(screen.getByLabelText(/^Mitigation \*/i), "Escalate");
    await user.click(screen.getByRole("button", { name: /Save risk/i }));

    // The risk floors the empty chips for DISPLAY, but completeness reads raw —
    // so the pill is unchanged: still 1/3, still incomplete.
    const pillAfter = container.querySelector<HTMLElement>("[data-complete]");
    expect(pillAfter?.textContent).toContain("1/3 Your stages");
    expect(pillAfter?.dataset.complete).toBe("false");
    // No derived status was persisted onto the products.
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
  });

  it("empty stage covered by own risk renders floored, counts in X/7, stays distinct from explicit status", () => {
    // No-refetch path: raw empty + live risk → re-derive coverage and floor.
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
      stageNames: ["Dev"],
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
      screen.getByRole("button", { name: "Dev: Blocked by risk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Testing: On track — status set" }),
    ).toBeInTheDocument();
  });

  it("an unscoped product risk does NOT tick the pill (root-cause guard)", () => {
    // A product risk without named stages must never count an untouched stage.
    // Dev stays uncounted → 1/2.
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
    const unscopedProductRisk: RiskEntry = {
      id: "r-all",
      productId: "crm",
      productName: "CRM Platform",
      stageNames: [],
      severity: "blocked",
      text: "Product-wide blocker",
      impact: "Broad",
      mitigation: "Escalate",
    };
    const { container } = render(
      <Harness
        initialProducts={[product]}
        initialRisks={[unscopedProductRisk]}
      />,
    );
    const pill = container.querySelector<HTMLElement>("[data-complete]");
    expect(pill?.textContent).toContain("1/2 Your stages");
    expect(pill?.dataset.complete).toBe("false");
  });
});

describe("LeadFormSyncBridge — severity floor and chip toggle", () => {
  const coveringRisk = (overrides?: Partial<RiskEntry>): RiskEntry => ({
    id: "r-dev",
    productId: "crm",
    productName: "CRM Platform",
    stageNames: ["Dev"],
    severity: "at-risk",
    text: "OAuth regression",
    impact: "Delay",
    mitigation: "Escalate",
    ...overrides,
  });

  it("a stale on-track chip renders at the covering risk's severity (floor)", () => {
    // Persisted explicit status says on-track; a non-empty covering blocked
    // risk forces the rendered chip to blocked without any state mutation.
    const product = buildProduct();
    const risk = coveringRisk({ severity: "blocked" });

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    expect(
      screen.getByRole("button", { name: /^Dev: Blocked/ }),
    ).toBeInTheDocument();
    // Uncovered sibling stage stays at its explicit status.
    expect(
      screen.getByRole("button", { name: /^Testing: On track/ }),
    ).toBeInTheDocument();
  });

  it("an orphan explicit blocked stage with no covering risk renders on-track on the live form", () => {
    // The read model already collapses an unbacked severity to on-track; the
    // live form must agree. A stage persisted blocked with NO covering risk
    // renders on-track so the risk-derived view stays authoritative.
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
      screen.getByRole("button", { name: /^Dev: On track/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Dev: Blocked/ }),
    ).not.toBeInTheDocument();
  });

  it("clicking an uncovered empty chip toggles it to on-track", async () => {
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: readonly Product[]) => void>();
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

    await user.click(screen.getByRole("button", { name: /^Dev: No status/ }));

    // The toggle applies straight through — no menu, no risk dialog.
    expect(
      screen.queryByRole("dialog", { name: /^Add risk/ }),
    ).not.toBeInTheDocument();
    expect(onProductsChangeSpy).toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: /^Dev: On track/ }),
    ).toBeInTheDocument();
  });

  it("clicking a risk-floored chip changes nothing and points at the Risks section", async () => {
    // Dev is persisted on-track but floored to blocked by a covering own risk,
    // so the click is a no-op with an info hint; the lead must edit the risk
    // to change the stage.
    const user = userEvent.setup();
    const onRisksChangeSpy = vi.fn<(next: readonly RiskEntry[]) => void>();
    const onProductsChangeSpy = vi.fn<(next: readonly Product[]) => void>();
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

    await user.click(screen.getByRole("button", { name: /^Dev: Blocked/ }));

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringMatching(/covering risk/i),
    );
    expect(onRisksChangeSpy).not.toHaveBeenCalled();
    expect(onProductsChangeSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^Dev: Blocked/ }),
    ).toBeInTheDocument();
  });

  it("a foreign risk floors the mine chip for display, hints, and does not block its toggle", async () => {
    // Everyone mode: a co-owner's covering risk colors the chip (display
    // floor). The toggle guard stays on own risks, so the lead still sets
    // their own status; a non-blocking hint explains the unchanged color.
    const user = userEvent.setup();
    const onProductsChangeSpy = vi.fn<(next: readonly Product[]) => void>();
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

    await user.click(screen.getByRole("button", { name: /^Dev: At risk/ }));

    expect(toast.info).toHaveBeenCalledWith(
      "Another lead's risk keeps this stage colored until that risk is resolved.",
    );
    expect(onProductsChangeSpy).toHaveBeenCalled();
  });

  it("an untouched mine stage covered only by a foreign risk colors but does not count", () => {
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
    const foreignRisk = coveringRisk({
      id: "r-foreign",
      severity: "blocked",
      foreign: true,
      authorName: "Other Lead",
    });

    const { container } = render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        displayRisks={[foreignRisk]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Dev: Blocked/ }),
    ).toBeInTheDocument();
    const pill = container.querySelector<HTMLElement>("[data-complete]");
    expect(pill?.textContent).toContain("1/2 Your stages");
    expect(pill?.dataset.complete).toBe("false");
  });
});
