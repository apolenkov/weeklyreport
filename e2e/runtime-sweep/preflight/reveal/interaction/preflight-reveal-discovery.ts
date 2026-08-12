import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
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
  MAX_REVEAL_BRANCHES,
  MAX_REVEAL_DEPTH,
  revealControlPreparationIdentityFor,
  revealPathFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import {
  assertRoutePath,
  requiredCurrentUrl,
} from "../guards/preflight-reveal-guards.ts";
import { revealStatePathIdentityFor } from "../guards/preflight-reveal-registration.ts";
import {
  processRevealQueue,
  type RevealCandidate,
  type RevealDiscoveryState,
} from "./preflight-reveal-branches.ts";
import {
  classifyRevealTransition,
  representativeInputFor,
  type RevealRepresentativeInput,
} from "./preflight-reveal-transition.ts";
import type {
  RevealControlFactory,
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

const plansFor = (inventory: DomInventory): readonly LiveControlPlan[] =>
  planLiveControlActions(sortedControls(inventory.controls), {
    formSafety: "disposable-reset",
  });

const revealCandidates = (
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

type RevealDiscoveryInput = Readonly<{
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly initialInventory: DomInventory;
  readonly harness: RevealExecutionHarness;
  readonly controlFor: RevealControlFactory;
  readonly maxDepth?: number;
  readonly maxBranches?: number;
  readonly maxActions?: number;
}>;

const revealBoundsFor = (
  input: RevealDiscoveryInput,
): Readonly<{
  readonly maxDepth: number;
  readonly maxBranches: number;
  readonly maxActions: number;
}> => {
  const maxDepth = input.maxDepth ?? MAX_REVEAL_DEPTH;
  const maxBranches = input.maxBranches ?? MAX_REVEAL_BRANCHES;
  const maxActions = input.maxActions ?? MAX_REVEAL_ACTIONS;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1)
    throw new RevealDiscoveryError(
      "Reveal depth bound must be a positive integer",
    );
  if (!Number.isSafeInteger(maxBranches) || maxBranches < 1)
    throw new RevealDiscoveryError(
      "Reveal branch bound must be a positive integer",
    );
  if (!Number.isSafeInteger(maxActions) || maxActions < 1)
    throw new RevealDiscoveryError(
      "Reveal action bound must be a positive integer",
    );
  return { maxDepth, maxBranches, maxActions };
};

const initialRevealStateFor = (
  input: RevealDiscoveryInput,
  initialSurface: ReturnType<typeof revealSurfaceFor>,
  initialUrl: string,
): RevealDiscoveryState => {
  const initialPath = revealPathFor([], initialUrl);
  const controls = plansFor(input.initialInventory).map((plan) =>
    input.controlFor(plan, initialPath, initialSurface),
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

export async function discoverRevealControls(
  input: RevealDiscoveryInput,
): Promise<readonly MatrixPreflightControl[]> {
  const { maxDepth, maxBranches, maxActions } = revealBoundsFor(input);
  const initialSurface = revealSurfaceFor(input.initialInventory.controls);
  const initialRawUrl = input.harness.currentUrl();
  const initialUrl = requiredCurrentUrl(initialRawUrl);
  assertRoutePath(input.route, initialUrl);
  const result = await processRevealQueue(
    {
      state: input.state,
      route: input.route,
      initialSurface,
      harness: input.harness,
      controlFor: input.controlFor,
      plansFor,
      candidatesFor: (inventory) => revealCandidates(inventory, input.route),
      maxDepth,
      maxBranches,
      maxActions,
    },
    initialRevealStateFor(input, initialSurface, initialUrl),
  );
  return result.controls.toSorted(comparePreflightControls);
}
