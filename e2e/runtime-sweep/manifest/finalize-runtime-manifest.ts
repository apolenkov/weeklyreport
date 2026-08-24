import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { writeCampaignManifest } from "./manifest.ts";

async function main(): Promise<void> {
  const { input } = await assertRuntimeSourceAuthorityFromEnvironment();
  await writeCampaignManifest(input);
  console.log(`runtime-manifest PASS ${input.sourceSha}`);
}

void main().catch((error: unknown) => {
  console.error("[runtime-manifest] Failed:", error);
  process.exitCode = 1;
});
