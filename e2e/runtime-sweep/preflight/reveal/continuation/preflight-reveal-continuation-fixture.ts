import { rm } from "node:fs/promises";

import { buildCampaignSource } from "../../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../../manifest/manifest-fixture.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { resolvePreflightCanarySelection } from "../../canary/preflight-canary.ts";
import {
  preflightControlForPlan,
  revealRouteFor,
} from "../../execution/playwright-preflight-support.ts";
import type { RevealExecutionHarness } from "../interaction/preflight-reveal-types.ts";
import {
  selectFreezerFor,
  type SelectRepresentative,
} from "./preflight-reveal-continuation-fixture-select.ts";
import {
  discoverRevealControlsChunk,
  type RevealContinuationBootstrapResult,
  type RevealContinuationChunkResult,
  type RevealContinuationReceiptChunkResult,
} from "./preflight-reveal-continuation-runner.ts";
import type { RevealExecutionGrant } from "./preflight-reveal-continuation-schemas.ts";

const ORIGIN = "http://127.0.0.1:3205";
const DATABASE_DIGEST_LENGTH = 64;
const DATABASE_DIGEST = "d".repeat(DATABASE_DIGEST_LENGTH);
const DOM_ORDER_WIDTH = 4;

export const controlFor = (
  controlKey: string,
  accessibleName: string,
  order: number,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(DOM_ORDER_WIDTH, "0")}:${controlKey}`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

export const inventoryFor = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

export const withSource = async <T>(
  callback: (
    source: Awaited<ReturnType<typeof buildCampaignSource>>,
  ) => Promise<T>,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(fixture.input, fakeManifestGit()),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

const unchanged = () => ({
  status: "unchanged" as const,
  beforeDigest: DATABASE_DIGEST,
  afterDigest: DATABASE_DIGEST,
});

const terminalFor = (
  url: string,
  inventory: DomInventory,
): Promise<Awaited<ReturnType<RevealExecutionHarness["executeReveal"]>>> =>
  Promise.resolve({ url, inventory, nonMutation: unchanged() });

const executeRevealFor = (input: {
  readonly actionKey: string;
  readonly route: ReturnType<typeof revealRouteFor>;
  readonly nested: DomInventory;
  readonly stableAllPostAction?: DomInventory;
  readonly stablePostAction?: DomInventory;
  readonly empty?: DomInventory;
  readonly later?: DomInventory;
  readonly crossRoute?: boolean;
  readonly state: { currentUrl: string };
}): Promise<Awaited<ReturnType<RevealExecutionHarness["executeReveal"]>>> => {
  if (input.stableAllPostAction !== undefined)
    return terminalFor(input.state.currentUrl, input.stableAllPostAction);
  if (input.actionKey === "button:a-open:0") {
    if (input.stablePostAction !== undefined)
      return terminalFor(input.state.currentUrl, input.stablePostAction);
    if (input.empty !== undefined) {
      input.state.currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=empty`;
      return terminalFor(input.state.currentUrl, input.empty);
    }
    input.state.currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=open#dialog`;
    return terminalFor(input.state.currentUrl, input.nested);
  }
  if (input.actionKey === "button:b-open:0") {
    input.state.currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=later`;
    return terminalFor(input.state.currentUrl, input.later ?? inventoryFor([]));
  }
  if (input.actionKey === "button:cross-route:0" && input.crossRoute === true) {
    input.state.currentUrl = `${ORIGIN}/admin/foreign`;
    return terminalFor(input.state.currentUrl, inventoryFor([]));
  }
  const query = input.actionKey === "button:n-first:0" ? "first" : "second";
  input.state.currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=${query}`;
  return terminalFor(input.state.currentUrl, inventoryFor([]));
};

const harnessFor = (input: {
  readonly route: ReturnType<typeof revealRouteFor>;
  readonly root: DomInventory;
  readonly nested: DomInventory;
  readonly stableAllPostAction?: DomInventory;
  readonly stablePostAction?: DomInventory;
  readonly empty?: DomInventory;
  readonly later?: DomInventory;
  readonly crossRoute?: boolean;
  readonly eventSink?: string[];
  readonly selectRepresentatives?: Readonly<
    Record<string, SelectRepresentative>
  >;
}) => {
  const state = { currentUrl: `${ORIGIN}${input.route.resolvedRoute}` };
  const events = input.eventSink ?? [];
  const currentInventory = () =>
    state.currentUrl.includes("panel=open")
      ? input.nested
      : state.currentUrl.includes("panel=empty")
        ? (input.empty ?? inventoryFor([]))
        : state.currentUrl.includes("panel=later")
          ? (input.later ?? inventoryFor([]))
          : input.root;
  const harness: RevealExecutionHarness = {
    prepare: () => {
      events.push("prepare");
      return Promise.resolve();
    },
    navigate: (route) => {
      events.push(`navigate:${route}`);
      state.currentUrl = `${ORIGIN}${route}`;
      return Promise.resolve();
    },
    currentUrl: () => state.currentUrl,
    inventory: () => Promise.resolve(currentInventory()),
    freezeRepresentativeInput: selectFreezerFor({
      currentInventory,
      events,
      ...(input.selectRepresentatives === undefined
        ? {}
        : { representatives: input.selectRepresentatives }),
    }),
    executeReveal: async ({ action, representativeInput }) => {
      events.push(`execute:${action.controlKey}`);
      const result = await executeRevealFor({
        actionKey: action.controlKey,
        route: input.route,
        nested: input.nested,
        ...(input.stableAllPostAction === undefined
          ? {}
          : { stableAllPostAction: input.stableAllPostAction }),
        ...(input.stablePostAction === undefined
          ? {}
          : { stablePostAction: input.stablePostAction }),
        ...(input.empty === undefined ? {} : { empty: input.empty }),
        ...(input.later === undefined ? {} : { later: input.later }),
        ...(input.crossRoute === undefined
          ? {}
          : { crossRoute: input.crossRoute }),
        state,
      });
      return {
        ...result,
        ...(representativeInput === undefined ? {} : { representativeInput }),
      };
    },
  };
  return { events, harness };
};

interface RunChunkInput {
  readonly source: Awaited<ReturnType<typeof buildCampaignSource>>;
  readonly state: Awaited<
    ReturnType<typeof buildCampaignSource>
  >["plan"]["states"][number];
  readonly route: ReturnType<typeof revealRouteFor>;
  readonly root: DomInventory;
  readonly nested: DomInventory;
  readonly stableAllPostAction?: DomInventory;
  readonly stablePostAction?: DomInventory;
  readonly empty?: DomInventory;
  readonly later?: DomInventory;
  readonly crossRoute?: boolean;
  readonly eventSink?: string[];
  readonly selectRepresentatives?: Readonly<
    Record<string, SelectRepresentative>
  >;
  readonly maxRevealActions?: number;
  readonly grant?: RevealExecutionGrant;
  readonly expectedGrantDigest?: string;
  readonly now?: () => number;
  readonly deadlineAt?: number;
}

const harnessInputFor = (input: RunChunkInput) => ({
  route: input.route,
  root: input.root,
  nested: input.nested,
  ...(input.stableAllPostAction === undefined
    ? {}
    : { stableAllPostAction: input.stableAllPostAction }),
  ...(input.stablePostAction === undefined
    ? {}
    : { stablePostAction: input.stablePostAction }),
  ...(input.empty === undefined ? {} : { empty: input.empty }),
  ...(input.later === undefined ? {} : { later: input.later }),
  ...(input.crossRoute === undefined ? {} : { crossRoute: input.crossRoute }),
  ...(input.eventSink === undefined ? {} : { eventSink: input.eventSink }),
  ...(input.selectRepresentatives === undefined
    ? {}
    : { selectRepresentatives: input.selectRepresentatives }),
});

const sourceFor = (input: RunChunkInput) =>
  input.maxRevealActions === undefined
    ? input.source
    : {
        ...input.source,
        matrixLimits: {
          ...input.source.matrixLimits,
          maxRevealActions: input.maxRevealActions,
        },
      };

const discoverInputFor = (
  input: RunChunkInput,
  source: RunChunkInput["source"],
  harness: ReturnType<typeof harnessFor>,
) => ({
  source,
  state: input.state,
  route: input.route,
  initialInventory: input.root,
  harness: harness.harness,
  controlFor: preflightControlForPlan,
  ...(input.grant === undefined ? {} : { grant: input.grant }),
  ...(input.expectedGrantDigest === undefined
    ? {}
    : { expectedGrantDigest: input.expectedGrantDigest }),
  executionScope: "canary" as const,
  attemptId: "attempt-fixture",
  ...(input.deadlineAt === undefined ? {} : { deadlineAt: input.deadlineAt }),
  ...(input.now === undefined ? {} : { now: input.now }),
});

export const runChunk = async (
  input: RunChunkInput,
): Promise<{
  readonly result: RevealContinuationReceiptChunkResult;
  readonly events: readonly string[];
}> => {
  const harness = harnessFor(harnessInputFor(input));
  const result = await discoverRevealControlsChunk(
    discoverInputFor(input, sourceFor(input), harness),
  );
  if (result.status !== "CHUNK")
    throw new Error("Fixture expected a receipt chunk");
  return { result, events: harness.events };
};

export const runBootstrap = async (
  input: RunChunkInput,
): Promise<{
  readonly result: RevealContinuationBootstrapResult;
  readonly events: readonly string[];
}> => {
  const harness = harnessFor(harnessInputFor(input));
  const result: RevealContinuationChunkResult =
    await discoverRevealControlsChunk(
      discoverInputFor(input, sourceFor(input), harness),
    );
  if (result.status !== "BOOTSTRAP")
    throw new Error("Fixture expected an empty-frontier bootstrap");
  return { result, events: harness.events };
};

export const selectionFor = (
  source: Awaited<ReturnType<typeof buildCampaignSource>>,
  stateId: string,
) => {
  const selection = resolvePreflightCanarySelection({
    source,
    selector: { stateId },
  });
  return { selection, route: revealRouteFor(selection.route) };
};
