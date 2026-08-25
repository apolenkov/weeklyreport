import { writeRevealContinuationAsset } from "./preflight-reveal-continuation-assets.ts";
import { assetsForGenesis } from "./preflight-reveal-continuation-grant-assets.ts";
import type {
  RevealBootstrap,
  RevealContinuationReceipt,
} from "./preflight-reveal-continuation-schemas.ts";
import { assetsForReceipt } from "./receipts/preflight-reveal-continuation-receipts.ts";

export const writeBootstrapAssets = async (input: {
  readonly archiveRoot: string | undefined;
  readonly result: Readonly<{ readonly bootstrap: RevealBootstrap }>;
}): Promise<void> => {
  if (input.archiveRoot === undefined) return;
  for (const asset of assetsForGenesis(input.result.bootstrap.genesis))
    await writeRevealContinuationAsset({
      archiveRoot: input.archiveRoot,
      asset,
    });
};

export const writeReceiptAssets = async (input: {
  readonly archiveRoot: string | undefined;
  readonly receipts: readonly RevealContinuationReceipt[];
}): Promise<void> => {
  if (input.archiveRoot === undefined) return;
  for (const receipt of input.receipts)
    for (const asset of assetsForReceipt(receipt))
      await writeRevealContinuationAsset({
        archiveRoot: input.archiveRoot,
        asset,
      });
};
