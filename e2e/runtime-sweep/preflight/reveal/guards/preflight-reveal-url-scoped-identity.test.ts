import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import { finalizeCampaignMatrix } from "../../../matrix/matrix-finalizer.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { CampaignManifest } from "../../../source/contracts.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "../interaction/preflight-reveal-discovery.ts";

const route = { resolvedRoute: "/lead/report" } as const;
const DATABASE_DIGEST = "d".repeat(64);

const observation = (
  controlKey: string,
  accessibleName: string,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `0000:${controlKey}`,
  order: 0,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "url-scoped-state",
  pairwiseDigest: "c".repeat(64),
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

const declaration: CampaignManifest["matrixDeclaration"] = {
  generatorSeed: "url-scoped-control",
  axes: {
    role: ["lead"],
    route: ["lead:/lead/report"],
    profileCapability: ["canonical-identities"],
    lifecycle: ["open"],
    submission: ["draft"],
    ownershipDensity: ["single"],
    permission: ["allowed"],
    fault: ["none"],
    controlTransition: ["none"],
  },
  constraints: [],
};

const routes: CampaignManifest["routes"] = [
  {
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
    landingRoute: "/lead/report",
    networkPolicy: null,
    bindings: [
      {
        status: "assigned",
        profile: "minimal",
        target: "none",
        requiredCapability: "canonical-identities",
        resolvedRoute: "/lead/report",
        landingRoute: "/lead/report",
        rationale: "URL-scoped control fixture",
      },
    ],
  },
];

const urlOnlyFixture = (): Readonly<{
  readonly initialInventory: DomInventory;
  readonly harness: RevealExecutionHarness;
}> => {
  const next = observation("button:Next:0", "Next");
  const done = observation("button:Done:0", "Done");
  const initialInventory = { controls: [next], issues: [] } as const;
  const finalInventory = { controls: [done], issues: [] } as const;
  const events = vi.fn<(controlKey: string) => void>();
  const step = (): number => events.mock.calls.length;
  const path = (): string =>
    step() === 0
      ? "/lead/report"
      : step() === 1
        ? "/lead/report?step=1"
        : "/lead/report?step=2";
  const currentInventory = (): DomInventory =>
    step() < 2 ? initialInventory : finalInventory;
  const harness: RevealExecutionHarness = {
    prepare: () => {
      events.mockClear();
      return Promise.resolve();
    },
    navigate: () => Promise.resolve(),
    currentUrl: () => new URL(path(), "http://127.0.0.1:3205").href,
    inventory: () => Promise.resolve(currentInventory()),
    executeReveal: ({ action }) => {
      events(action.controlKey);
      return Promise.resolve({
        url: new URL(path(), "http://127.0.0.1:3205").href,
        inventory: currentInventory(),
        nonMutation: {
          status: "unchanged",
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { initialInventory, harness };
};

describe("URL-scoped reveal control identity", () => {
  it("replays a same-surface control after a URL-only transition", async () => {
    const fixture = urlOnlyFixture();
    const controls = await discoverRevealControls({
      state,
      route,
      initialInventory: fixture.initialInventory,
      harness: fixture.harness,
      controlFor: preflightControlForPlan,
    });
    const nextControls = controls.filter(
      ({ controlKey }) => controlKey === "button:Next:0",
    );
    expect(nextControls).toHaveLength(2);
    expect(
      new Set(
        nextControls.map(
          ({ expectedActionTransition }) => expectedActionTransition?.beforeUrl,
        ),
      ),
    ).toEqual(new Set(["/lead/report", "/lead/report?step=1"]));
    expect(
      controls.find(({ controlKey }) => controlKey === "button:Done:0")
        ?.revealPath.steps,
    ).toHaveLength(2);
    const matrix = finalizeCampaignMatrix({
      sourceSha: "c".repeat(40),
      declaration,
      plan: { states: [state], inapplicable: [], digest: "url-scoped-plan" },
      routes,
      preflight: [{ state, controls, specialized: [] }],
      maxCases: 10_000,
      maxControlsPerSegment: 8192,
    });
    expect(
      matrix.cases.filter(({ controlKey }) => controlKey === "button:Next:0"),
    ).toHaveLength(2);
    expect(
      matrix.cases.some(({ controlKey }) => controlKey === "button:Done:0"),
    ).toBe(true);
  });
});
