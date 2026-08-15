import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type { DomInventory } from "../../replay/dom/dom-inventory.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { preflightControlForPlan } from "../execution/playwright-preflight-support.ts";
import type { RevealReducerInput } from "../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import {
  initialRevealStateFor,
  plansFor,
  revealCandidatesFor,
} from "../reveal/interaction/preflight-reveal-discovery.ts";
import type { RevealRoute } from "../reveal/interaction/preflight-reveal-types.ts";
import { MAX_REVEAL_DEPTH, revealSurfaceFor } from "../reveal-path.ts";

export type ParentReplayContext = Readonly<{
  readonly initialState: ReturnType<typeof initialRevealStateFor>;
  readonly queueInput: RevealReducerInput;
}>;

export const parentReplayContextFor = (input: {
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealRoute;
  readonly initialUrl: string;
  readonly initialInventory: DomInventory;
}): ParentReplayContext => {
  const initialSurface = revealSurfaceFor(input.initialInventory.controls);
  const initialState = initialRevealStateFor(
    {
      initialInventory: input.initialInventory,
      controlFor: preflightControlForPlan,
    },
    initialSurface,
    input.initialUrl,
  );
  return {
    initialState,
    queueInput: {
      state: input.state,
      route: input.route,
      initialSurface,
      controlFor: preflightControlForPlan,
      plansFor,
      candidatesFor: (inventory) => revealCandidatesFor(inventory, input.route),
      maxDepth: MAX_REVEAL_DEPTH,
      maxRevealMaterialEdges: input.source.matrixLimits.maxRevealMaterialEdges,
      maxRevealActions: input.source.matrixLimits.maxRevealActions,
    },
  };
};
