import "dotenv/config";

import { assertNonProdDestructive } from "../../guards/_destructive-guard.js";
import { isEntrypoint } from "../../guards/_entrypoint.js";
import {
  assertManifestLadder,
  parseSeedProfile,
} from "./seed-profile-contract.js";
import { runSeedProfile } from "./seed-profile-runner.js";

export function main(argv: readonly string[] = process.argv): void {
  const profile = parseSeedProfile(argv[2]);
  assertManifestLadder();
  assertNonProdDestructive(`seed-profile:${profile}`);
  runSeedProfile(profile);
}

if (isEntrypoint(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    console.error("[seed-profile] Failed:", error);
    process.exitCode = 1;
  }
}
