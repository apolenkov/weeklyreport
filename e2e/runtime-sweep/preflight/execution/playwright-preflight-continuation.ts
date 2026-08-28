import type { Page } from "@playwright/test";

import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import { strictRouteFor } from "../reveal/continuation/contracts/preflight-reveal-continuation-contract-factories.ts";
import type { RevealContinuationCooperativeLimits } from "../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type { RevealExecutionGrant } from "../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  assertRevealExecutionGrantInput,
  discoverRevealControlsChunk,
  type RevealContinuationChunkResult,
} from "../reveal/continuation/preflight-reveal-continuation-runner.ts";
import { assertRevealExecutionGrantSource } from "../reveal/continuation/preflight-reveal-continuation-validators.ts";
import {
  assertInitialLanding,
  assertResolverOutcomeUi,
} from "../reveal/guards/preflight-reveal-guards.ts";
import type { RevealPreparation } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  navigateToRevealLanding,
  playwrightHarnessFor,
  revealHarnessFor,
} from "./playwright-preflight.ts";
import {
  BrowserPreflightError,
  type BrowserPreflightHarness,
  preflightControlForPlan,
  type PreflightRoute,
  revealRouteFor,
  routeForState,
} from "./playwright-preflight-support.ts";

interface ContinuationChunkInput {
  readonly source: SourceArtifact;
  readonly archiveRoot?: string;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly page: Page;
  readonly expectedOrigin: string;
  readonly prepare: (
    state: Parameters<BrowserPreflightHarness["prepare"]>[0],
    route: PreflightRoute,
    resetRequired: boolean,
  ) => Promise<RevealPreparation>;
  readonly grant?: RevealExecutionGrant;
  readonly expectedGrantDigest?: string;
  readonly attemptId: string;
  readonly childExecutionId: string;
  readonly childOrdinal: number;
  readonly deadlineAt?: number;
  readonly chunkBudgetMs?: number;
  readonly cooperativeLimits?: RevealContinuationCooperativeLimits;
  readonly now?: () => number;
  readonly compactResume?: boolean;
}

const assertExactSourceState = (input: ContinuationChunkInput): void => {
  const sourceState = input.source.plan.states.find(
    ({ stateId }) => stateId === input.state.stateId,
  );
  if (
    sourceState === undefined ||
    stableSerialize(sourceState) !== stableSerialize(input.state)
  )
    throw new BrowserPreflightError(
      "Reveal continuation state is not the exact source-derived state",
    );
};

const assertGrantBeforeBrowser = (input: {
  readonly continuation: ContinuationChunkInput;
  readonly revealRoute: ReturnType<typeof revealRouteFor>;
}): void => {
  const { continuation, revealRoute } = input;
  if (continuation.grant === undefined) return;
  assertRevealExecutionGrantSource({
    grant: continuation.grant,
    source: continuation.source,
    state: continuation.state,
    route: strictRouteFor(revealRoute),
    executionScope: "canary",
    attemptId: continuation.attemptId,
    ...(continuation.expectedGrantDigest === undefined
      ? {}
      : { expectedGrantDigest: continuation.expectedGrantDigest }),
  });
};

const initialInventoryFor = async (input: {
  readonly continuation: ContinuationChunkInput;
  readonly harness: ReturnType<typeof playwrightHarnessFor>;
  readonly route: PreflightRoute;
}) => {
  const { continuation, harness, route } = input;
  await harness.prepare(continuation.state, route, true);
  await harness.navigate(route.resolvedRoute);
  assertInitialLanding(
    route,
    harness.currentUrl(),
    continuation.expectedOrigin,
  );
  await navigateToRevealLanding(harness, route);
  const initialInventory = await harness.inventory();
  if (route.expectedOutcome !== undefined)
    assertResolverOutcomeUi(route.expectedOutcome, initialInventory);
  return initialInventory;
};

/**
 * Runs one canary-only continuation child. Preparation, navigation and the
 * initial inventory always occur in this fresh invocation; the reducer may
 * then replay receipts and branchFor replays only the next candidate path.
 */
export async function runPlaywrightPreflightRevealContinuationChunk(
  input: ContinuationChunkInput,
): Promise<RevealContinuationChunkResult> {
  assertRevealExecutionGrantInput(input);
  assertExactSourceState(input);
  const route = routeForState(input.source, input.state);
  const revealRoute = revealRouteFor(route);
  assertGrantBeforeBrowser({ continuation: input, revealRoute });
  const harness = playwrightHarnessFor(input);
  const initialInventory = await initialInventoryFor({
    continuation: input,
    harness,
    route,
  });
  const result = await discoverRevealControlsChunk({
    source: input.source,
    ...(input.archiveRoot === undefined
      ? {}
      : { archiveRoot: input.archiveRoot }),
    state: input.state,
    route: revealRoute,
    initialInventory,
    harness: revealHarnessFor(harness),
    controlFor: preflightControlForPlan,
    ...(input.grant === undefined ? {} : { grant: input.grant }),
    ...(input.expectedGrantDigest === undefined
      ? {}
      : {
          expectedGrantDigest: input.expectedGrantDigest,
        }),
    executionScope: "canary",
    attemptId: input.attemptId,
    childExecutionId: input.childExecutionId,
    childOrdinal: input.childOrdinal,
    ...(input.deadlineAt === undefined ? {} : { deadlineAt: input.deadlineAt }),
    ...(input.chunkBudgetMs === undefined
      ? {}
      : { chunkBudgetMs: input.chunkBudgetMs }),
    ...(input.cooperativeLimits === undefined
      ? {}
      : { cooperativeLimits: input.cooperativeLimits }),
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.compactResume === undefined
      ? {}
      : { compactResume: input.compactResume }),
  });
  if (
    result.controls !== undefined &&
    result.controls.length > input.source.matrixLimits.maxControlsPerSegment
  )
    throw new BrowserPreflightError(
      `Preflight segment ${input.state.stateId} has ${result.controls.length} controls; maxControlsPerSegment is ${input.source.matrixLimits.maxControlsPerSegment}`,
    );
  return result;
}
