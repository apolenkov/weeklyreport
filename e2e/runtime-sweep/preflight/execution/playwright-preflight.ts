import type { Page } from "@playwright/test";

import type { MatrixPreflightSegment } from "../../matrix/finalization/matrix-finalizer-contract.ts";
import { assertSpecializedDeclarations } from "../../matrix/specialized/specialized-declarations.ts";
import { inventoryDom } from "../../replay/dom/dom-inventory.ts";
import { navigate, navigateReveal } from "../../replay/navigation.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import {
  createPreflightArtifact,
  type PreflightArtifact,
} from "../artifacts/preflight-artifact.ts";
import {
  assertInitialLanding,
  assertResolverOutcomeUi,
} from "../reveal/guards/preflight-reveal-guards.ts";
import { discoverRevealControls } from "../reveal/interaction/preflight-reveal-discovery.ts";
import type { RevealPreparation } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  preflightGroupNeedsReset,
  preflightSessionGroupKey,
} from "../runtime/preflight-session.ts";
import {
  navigateToRevealLanding,
  revealHarnessFor,
  type RevealNavigationHarness,
} from "./playwright-preflight-reveal-harness.ts";
import {
  assertSpecializedNominalTargets,
  attachSpecializedDeclarations,
  BrowserPreflightError,
  type BrowserPreflightHarness,
  preflightControlForPlan,
  type PreflightRoute,
  routeForState,
} from "./playwright-preflight-support.ts";
import {
  createPlaywrightRevealExecutor,
  createPlaywrightRevealRepresentativeInputFreezer,
} from "./playwright-reveal-execution.ts";
export {
  navigateToRevealLanding,
  revealHarnessFor,
} from "./playwright-preflight-reveal-harness.ts";
export {
  assertSpecializedNominalTargets,
  BrowserPreflightError,
  type BrowserPreflightHarness,
  preflightControlForPlan,
  type PreflightRoute,
} from "./playwright-preflight-support.ts";

type PreflightEntry = Readonly<{
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
}>;

type PreflightRunState = Readonly<{
  readonly segments: readonly MatrixPreflightSegment[];
  readonly preparedGroup: string | undefined;
}>;

export type BrowserPreflightSegmentResult = Readonly<{
  readonly segment: MatrixPreflightSegment;
  readonly preparedGroup: string;
}>;

const entriesFor = (source: SourceArtifact): readonly PreflightEntry[] =>
  source.plan.states
    .map((state) => ({ state, route: routeForState(source, state) }))
    .toSorted((left, right) => {
      const bySession = preflightSessionGroupKey(
        left.state,
        left.route,
      ).localeCompare(preflightSessionGroupKey(right.state, right.route));
      const byRoute = left.route.resolvedRoute.localeCompare(
        right.route.resolvedRoute,
      );
      return (
        bySession ||
        byRoute ||
        left.state.stateId.localeCompare(right.state.stateId)
      );
    });

const assertCurrentUrlCallback = (harness: BrowserPreflightHarness): void => {
  if (typeof harness.currentUrl !== "function")
    throw new BrowserPreflightError(
      "Browser preflight current URL callback is not configured",
    );
};

export async function runBrowserPreflightSegment(input: {
  readonly source: SourceArtifact;
  readonly state: PreflightEntry["state"];
  readonly route?: PreflightRoute;
  readonly harness: BrowserPreflightHarness;
  readonly resetRequired: boolean;
}): Promise<BrowserPreflightSegmentResult> {
  assertCurrentUrlCallback(input.harness);
  const route = input.route ?? routeForState(input.source, input.state);
  const preparedGroup = preflightSessionGroupKey(input.state, route);
  await input.harness.prepare(input.state, route, input.resetRequired);
  await input.harness.navigate(route.resolvedRoute);
  assertInitialLanding(
    route,
    input.harness.currentUrl(),
    input.harness.expectedOrigin,
  );
  const revealRoute = await navigateToRevealLanding(input.harness, route);
  const initialInventory = await input.harness.inventory();
  if (route.expectedOutcome !== undefined)
    assertResolverOutcomeUi(route.expectedOutcome, initialInventory);
  const controls = await discoverRevealControls({
    state: input.state,
    route: revealRoute,
    initialInventory,
    harness: revealHarnessFor(input.harness),
    controlFor: preflightControlForPlan,
    maxRevealMaterialEdges: input.source.matrixLimits.maxRevealMaterialEdges,
    maxRevealActions: input.source.matrixLimits.maxRevealActions,
    maxControlsPerSegment: input.source.matrixLimits.maxControlsPerSegment,
  });
  if (controls.length > input.source.matrixLimits.maxControlsPerSegment)
    throw new BrowserPreflightError(
      `Preflight segment ${input.state.stateId} has ${controls.length} controls; maxControlsPerSegment is ${input.source.matrixLimits.maxControlsPerSegment}`,
    );
  return {
    segment: { state: input.state, controls, specialized: [] },
    preparedGroup,
  };
}

const runEntry = async (
  harness: BrowserPreflightHarness,
  prior: PreflightRunState,
  { state, route }: PreflightEntry,
  source: SourceArtifact,
): Promise<PreflightRunState> => {
  const preparedGroup = preflightSessionGroupKey(state, route);
  const result = await runBrowserPreflightSegment({
    source,
    state,
    route,
    harness,
    resetRequired: preflightGroupNeedsReset(
      prior.preparedGroup,
      preparedGroup,
      false,
    ),
  });
  return {
    segments: [...prior.segments, result.segment],
    preparedGroup: result.preparedGroup,
  };
};

export async function runBrowserPreflight(input: {
  readonly source: SourceArtifact;
  readonly harness: BrowserPreflightHarness;
}): Promise<PreflightArtifact> {
  assertCurrentUrlCallback(input.harness);
  assertSpecializedDeclarations(input.source.specializedDeclarations);
  assertSpecializedNominalTargets(input.source);
  const result = await entriesFor(input.source).reduce<
    Promise<PreflightRunState>
  >(
    async (promise, entry) =>
      runEntry(input.harness, await promise, entry, input.source),
    Promise.resolve({ segments: [], preparedGroup: undefined }),
  );
  return createPreflightArtifact({
    source: input.source,
    segments: attachSpecializedDeclarations(input.source, result.segments),
  });
}

export const playwrightHarnessFor = (input: {
  readonly source: SourceArtifact;
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly prepare: (
    state: Parameters<BrowserPreflightHarness["prepare"]>[0],
    route: PreflightRoute,
    resetRequired: boolean,
  ) => Promise<RevealPreparation>;
}): RevealNavigationHarness => {
  const executeReveal = createPlaywrightRevealExecutor(input);
  const freezeRepresentativeInput =
    createPlaywrightRevealRepresentativeInputFreezer(input);
  return {
    expectedOrigin: input.expectedOrigin,
    prepare: input.prepare,
    navigate: async (route) => {
      await navigate(input.page, route);
    },
    navigateReveal: async (route) => {
      await navigateReveal(input.page, route);
    },
    currentUrl: () => input.page.url(),
    inventory: () => inventoryDom(input.page),
    freezeRepresentativeInput,
    executeReveal,
  };
};

export function runPlaywrightPreflightSegment(input: {
  readonly source: SourceArtifact;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly prepare: (
    state: Parameters<BrowserPreflightHarness["prepare"]>[0],
    route: PreflightRoute,
    resetRequired: boolean,
  ) => Promise<RevealPreparation>;
  readonly resetRequired?: boolean;
}): Promise<BrowserPreflightSegmentResult> {
  const harness = playwrightHarnessFor(input);
  return runBrowserPreflightSegment({
    source: input.source,
    state: input.state,
    harness,
    resetRequired: input.resetRequired ?? true,
  });
}

export function runPlaywrightPreflight(input: {
  readonly source: SourceArtifact;
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly prepare: (
    state: Parameters<BrowserPreflightHarness["prepare"]>[0],
    route: PreflightRoute,
    resetRequired: boolean,
  ) => Promise<RevealPreparation>;
}): Promise<PreflightArtifact> {
  return runBrowserPreflight({
    source: input.source,
    harness: playwrightHarnessFor(input),
  });
}
