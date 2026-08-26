import { buildCampaignSource } from "../../../manifest/manifest.ts";
import { resolvePreflightCanarySelection } from "../../canary/preflight-canary.ts";
import { revealRouteFor } from "../../execution/playwright-preflight-support.ts";

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
