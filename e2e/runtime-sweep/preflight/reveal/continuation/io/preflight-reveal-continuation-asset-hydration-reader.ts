import * as path from "node:path";

import { assertPreflightArchivePath } from "../../../preflight-archive-path.ts";
import {
  readAndRememberRevealContinuationAssetWithinVerifiedDirectory,
  type RevealContinuationAsset,
  revealContinuationAssetDirectoryFor,
} from "../preflight-reveal-continuation-assets.ts";

type HydrationAssetInput = Readonly<{
  artifact: RevealContinuationAsset["artifact"];
  ref: string;
}>;

/**
 * Creates a reader for one immutable hydration graph. Directory boundaries are
 * checked once per asset kind; every file still uses O_NOFOLLOW, fstat, byte
 * bounds, canonical JSON, schema validation, and its content digest.
 */
export const createRevealContinuationAssetHydrationReader = (input: {
  readonly archiveRoot: string;
}): Readonly<{
  readAndRemember: (
    assetInput: HydrationAssetInput,
  ) => Promise<RevealContinuationAsset>;
}> => {
  const archiveRoot = path.resolve(input.archiveRoot);
  const assertedDirectories = new Map<
    RevealContinuationAsset["artifact"],
    Promise<unknown>
  >();
  const assertAssetDirectory = (
    artifact: RevealContinuationAsset["artifact"],
  ): Promise<unknown> => {
    const existing = assertedDirectories.get(artifact);
    if (existing !== undefined) return existing;
    const assertion = assertPreflightArchivePath(
      archiveRoot,
      path.join(
        revealContinuationAssetDirectoryFor(archiveRoot, artifact),
        ".asset-boundary",
      ),
    );
    assertedDirectories.set(artifact, assertion);
    return assertion;
  };
  return Object.freeze({
    readAndRemember: async (assetInput) => {
      await assertAssetDirectory(assetInput.artifact);
      return readAndRememberRevealContinuationAssetWithinVerifiedDirectory({
        archiveRoot,
        artifact: assetInput.artifact,
        ref: assetInput.ref,
      });
    },
  });
};
