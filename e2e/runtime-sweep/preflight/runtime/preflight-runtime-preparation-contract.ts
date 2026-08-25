import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type { PreflightRoute } from "../execution/playwright-preflight-support.ts";
import type { RevealPreparation } from "../reveal/interaction/preflight-reveal-types.ts";

export type PreflightRuntimePreparation = (
  state: CampaignMatrixState,
  route: PreflightRoute,
  groupChanged: boolean,
) => Promise<RevealPreparation>;

export type PreflightRuntimePreparationWithBoundary =
  PreflightRuntimePreparation &
    Readonly<{
      readonly recreateDisposableBoundary: () => Promise<void>;
    }>;
