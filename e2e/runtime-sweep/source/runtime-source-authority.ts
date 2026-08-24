import {
  buildCampaignSource,
  type ManifestCommandRunner,
} from "../manifest/manifest.ts";
import { buildRuntimeManifestInput } from "./create-runtime-manifest.ts";
import { runGitCommand } from "./manifest-source.ts";
import { assertValidatedRuntimeSource } from "./runtime-source-validation.ts";

export async function assertRuntimeSourceAuthorityFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<
  Readonly<{
    input: Awaited<ReturnType<typeof buildRuntimeManifestInput>>;
    source: Awaited<ReturnType<typeof buildCampaignSource>>;
    receipt: Awaited<
      ReturnType<typeof assertValidatedRuntimeSource>
    >["receipt"];
    receiptFileSha256: string;
  }>
> {
  const input = await buildRuntimeManifestInput(environment);
  if (
    input.sourcePath === undefined ||
    input.sourceValidationPath === undefined
  )
    throw new Error("Runtime source authority paths are required");
  if (input.sourceValidationFileSha256 === undefined)
    throw new Error(
      "Runtime source authority requires RUNTIME_SWEEP_SOURCE_VALIDATION_SHA256",
    );
  const expectedSource = await buildCampaignSource(input, runCommand);
  const validated = await assertValidatedRuntimeSource({
    sourcePath: input.sourcePath,
    receiptPath: input.sourceValidationPath,
    expectedSource,
    expectedReceiptFileSha256: input.sourceValidationFileSha256,
  });
  return { input, ...validated };
}
