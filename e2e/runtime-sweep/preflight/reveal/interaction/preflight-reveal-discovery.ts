import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { DEFAULT_MAX_CONTROLS_PER_SEGMENT } from "../../../matrix/matrix-limits.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import {
  type LiveControlPlan,
  planLiveControlActions,
} from "../../../replay/live-control/live-control-planning.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  compareRevealControlIdentity,
  MAX_REVEAL_ACTIONS,
  MAX_REVEAL_DEPTH,
  MAX_REVEAL_MATERIAL_EDGES,
  revealControlPreparationIdentityFor,
  revealPathFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import {
  assertRoutePath,
  requiredCurrentUrl,
} from "../guards/preflight-reveal-guards.ts";
import type { RevealReductionContext } from "../guards/preflight-reveal-reduction-context.ts";
import { revealStatePathIdentityFor } from "../guards/preflight-reveal-registration.ts";
import {
  assertRevealControlCapacity,
  type RevealCandidate,
  type RevealCandidateFailureHandler,
  type RevealDiscoveryState,
} from "./preflight-reveal-branches.ts";
import { processRevealQueueChunk } from "./preflight-reveal-queue.ts";
import {
  classifyRevealTransition,
  representativeInputFor,
  type RevealRepresentativeInput,
} from "./preflight-reveal-transition.ts";
import type {
  RevealControlFactory,
  RevealDiscoveryWithSummary,
  RevealExecutionHarness,
  RevealRoute,
} from "./preflight-reveal-types.ts";
export type {
  RevealExecution,
  RevealExecutionHarness,
  RevealRoute,
} from "./preflight-reveal-types.ts";
import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

const READ_ONLY_CLICK = "read-only-click" as const;
const CLIENT_FORM = "client-form" as const;

const sortedControls = (
  controls: readonly DomControlObservation[],
): readonly DomControlObservation[] =>
  controls.toSorted((left, right) => {
    const byKey = left.controlKey.localeCompare(right.controlKey);
    return byKey || stableSerialize(left).localeCompare(stableSerialize(right));
  });

export const plansFor = (inventory: DomInventory): readonly LiveControlPlan[] =>
  planLiveControlActions(sortedControls(inventory.controls), {
    formSafety: "disposable-reset",
  });

export const revealCandidatesFor = (
  inventory: DomInventory,
  route: RevealRoute,
): readonly RevealCandidate[] => {
  const plans = plansFor(inventory);
  const classifications = plans.map((plan) => ({
    plan,
    classification: classifyRevealTransition(plan, route),
  }));
  return classifications
    .flatMap(({ plan, classification }) => {
      if (
        classification.kind !== READ_ONLY_CLICK &&
        classification.kind !== CLIENT_FORM
      )
        return [];
      const representativeInput: RevealRepresentativeInput | undefined =
        classification.kind === CLIENT_FORM
          ? representativeInputFor(plan)
          : undefined;
      if (
        classification.kind === CLIENT_FORM &&
        representativeInput === undefined &&
        plan.action?.operation === "fill"
      )
        throw new RevealDiscoveryError(
          `Client-only form reveal lacks a representative input: ${plan.control.controlKey}`,
        );
      return [
        {
          ...plan,
          action: classification.action,
          ...(representativeInput === undefined ? {} : { representativeInput }),
        },
      ];
    })
    .toSorted((left, right) =>
      left.control.controlKey.localeCompare(right.control.controlKey),
    );
};

export type RevealDiscoveryInput = Readonly<{
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly reductionContext?: RevealReductionContext;
  readonly initialInventory: DomInventory;
  readonly harness: RevealExecutionHarness;
  readonly controlFor: RevealControlFactory;
  readonly maxDepth?: number;
  readonly maxRevealMaterialEdges?: number;
  readonly maxRevealActions?: number;
  readonly maxControlsPerSegment?: number;
  readonly onProgress?: (
    progress: import("./preflight-reveal-types.ts").RevealDiscoveryProgress,
  ) => void;
  readonly onCandidateFailure?: RevealCandidateFailureHandler;
}>;

const revealBoundsFor = (
  input: RevealDiscoveryInput,
): Readonly<{
  readonly maxDepth: number;
  readonly maxRevealMaterialEdges: number;
  readonly maxRevealActions: number;
  readonly maxControlsPerSegment: number;
}> => {
  const maxDepth = input.maxDepth ?? MAX_REVEAL_DEPTH;
  const maxRevealMaterialEdges =
    input.maxRevealMaterialEdges ?? MAX_REVEAL_MATERIAL_EDGES;
  const maxRevealActions = input.maxRevealActions ?? MAX_REVEAL_ACTIONS;
  const maxControlsPerSegment =
    input.maxControlsPerSegment ?? DEFAULT_MAX_CONTROLS_PER_SEGMENT;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1)
    throw new RevealDiscoveryError(
      "Reveal depth bound must be a positive integer",
    );
  if (
    !Number.isSafeInteger(maxRevealMaterialEdges) ||
    maxRevealMaterialEdges < 1
  )
    throw new RevealDiscoveryError(
      "Reveal material edge bound must be a positive integer",
    );
  if (!Number.isSafeInteger(maxRevealActions) || maxRevealActions < 1)
    throw new RevealDiscoveryError(
      "Reveal action bound must be a positive integer",
    );
  if (!Number.isSafeInteger(maxControlsPerSegment) || maxControlsPerSegment < 1)
    throw new RevealDiscoveryError(
      "Reveal control bound must be a positive integer",
    );
  return {
    maxDepth,
    maxRevealMaterialEdges,
    maxRevealActions,
    maxControlsPerSegment,
  };
};

export const initialRevealStateFor = (
  input: Pick<
    RevealDiscoveryInput,
    "initialInventory" | "controlFor" | "maxControlsPerSegment"
  >,
  initialSurface: ReturnType<typeof revealSurfaceFor>,
  initialUrl: string,
): RevealDiscoveryState => {
  const initialPath = revealPathFor([], initialUrl);
  const controls = plansFor(input.initialInventory).map((plan) =>
    input.controlFor(plan, initialPath, initialSurface),
  );
  assertRevealControlCapacity(
    controls.length,
    input.maxControlsPerSegment ?? DEFAULT_MAX_CONTROLS_PER_SEGMENT,
  );
  const discovered = new Map(
    initialSurface.controls.map((control) => [
      revealControlPreparationIdentityFor(
        control.controlKey,
        initialPath,
        initialSurface,
      ),
      {
        signature: stableSerialize(control),
        pathDigest: initialPath.digest,
        surfaceDigest: initialSurface.digest,
      },
    ]),
  );
  return {
    queue: [
      {
        path: initialPath,
        inventory: input.initialInventory,
        surface: initialSurface,
        url: initialUrl,
        preparation: undefined,
      },
    ],
    controls,
    discovered,
    visitedStatePaths: new Map([
      [
        revealStatePathIdentityFor({
          path: initialPath,
          surface: initialSurface,
          url: initialUrl,
        }),
        initialPath.digest,
      ],
    ]),
    actionCount: 0,
    branchCount: 0,
  };
};

const comparePreflightControls = (
  left: MatrixPreflightControl,
  right: MatrixPreflightControl,
): number =>
  compareRevealControlIdentity(
    {
      controlKey: left.controlKey,
      revealPathDigest: left.revealPath.digest,
      expectedSurfaceDigest: left.expectedSurface.digest,
    },
    {
      controlKey: right.controlKey,
      revealPathDigest: right.revealPath.digest,
      expectedSurfaceDigest: right.expectedSurface.digest,
    },
  );

export async function discoverRevealControlsWithSummary(
  input: RevealDiscoveryInput,
): Promise<RevealDiscoveryWithSummary> {
  const {
    maxDepth,
    maxRevealMaterialEdges,
    maxRevealActions,
    maxControlsPerSegment,
  } = revealBoundsFor(input);
  const initialSurface = revealSurfaceFor(input.initialInventory.controls);
  const initialUrl = requiredCurrentUrl(input.harness.currentUrl());
  assertRoutePath(input.route, initialUrl);
  const queueInput = {
    ...input,
    initialSurface,
    plansFor,
    candidatesFor: (inventory: DomInventory) =>
      revealCandidatesFor(inventory, input.route),
    maxDepth,
    maxRevealMaterialEdges,
    maxRevealActions,
    maxControlsPerSegment,
  };
  const initialState = initialRevealStateFor(
    { ...input, maxControlsPerSegment },
    initialSurface,
    initialUrl,
  );
  const metrics = { candidateCount: 0, queueLength: initialState.queue.length };
  const result = await processRevealQueueChunk(
    queueInput,
    initialState,
    ({ state: currentState, remainingQueue }) => {
      metrics.candidateCount += 1;
      metrics.queueLength = Math.max(
        metrics.queueLength,
        remainingQueue.length,
      );
      input.onProgress?.({
        completedCandidateCount: metrics.candidateCount,
        revealActionCount: currentState.actionCount,
        materialEdgeCount: currentState.branchCount,
        controlCount: currentState.controls.length,
        visitedStateCount: currentState.visitedStatePaths.size,
        queueLength: remainingQueue.length,
        maxQueueLength: metrics.queueLength,
      });
      return false;
    },
  );
  if (!result.completed || result.state.queue.length > 0)
    throw new RevealDiscoveryError("Reveal queue did not exhaust");
  return {
    controls: result.state.controls.toSorted(comparePreflightControls),
    summary: {
      completedCandidateCount: metrics.candidateCount,
      revealActionCount: result.state.actionCount,
      materialEdgeCount: result.state.branchCount,
      controlCount: result.state.controls.length,
      visitedStateCount: result.state.visitedStatePaths.size,
      maxQueueLength: metrics.queueLength,
      initialSurfaceDigest: initialSurface.digest,
      queueEmpty: true,
    },
  };
}

export const discoverRevealControls = (input: RevealDiscoveryInput) =>
  discoverRevealControlsWithSummary(input).then(({ controls }) => controls);
