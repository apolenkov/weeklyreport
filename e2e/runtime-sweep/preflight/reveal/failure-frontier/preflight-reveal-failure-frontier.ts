import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import type { RevealCandidateFailure } from "../interaction/preflight-reveal-branches.ts";
import { captureRevealFailureFrontier } from "./preflight-reveal-failure-frontier-io.ts";

export {
  FAILURE_FRONTIER_LIMITS,
  FAILURE_FRONTIER_MANIFEST_NAME,
  RevealFailureFrontierError,
} from "./preflight-reveal-failure-frontier-contract.ts";
export {
  assertFailureFrontierManifestAbsent,
  captureRevealFailureFrontier,
  readRevealFailureFrontierPacket,
} from "./preflight-reveal-failure-frontier-io.ts";
export { replayRevealFailureFrontierBoundary } from "./preflight-reveal-failure-frontier-replay.ts";

export const createRevealFailureFrontierHandler = (input: {
  readonly packetRoot: string;
  readonly plan: CapacitySurveyPlan;
  readonly beforeCapture: () => Promise<void>;
}) => {
  const state = { attempted: false };
  return async (failure: RevealCandidateFailure): Promise<void> => {
    if (state.attempted) return;
    state.attempted = true;
    await input.beforeCapture();
    await captureRevealFailureFrontier({ ...input, failure });
  };
};
