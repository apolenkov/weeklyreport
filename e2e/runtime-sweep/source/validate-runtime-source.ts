import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCampaignSource } from "../manifest/manifest.ts";
import { buildRuntimeManifestInput } from "./create-runtime-manifest.ts";
import {
  assertValidatedRuntimeSource,
  writeRuntimeSourceValidationReceipt,
} from "./runtime-source-validation.ts";

export async function validateRuntimeSourceCli(
  mode: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (mode !== "create" && mode !== "check")
    throw new Error("Runtime source validation mode must be create or check");
  const input = await buildRuntimeManifestInput(environment);
  if (
    input.sourcePath === undefined ||
    input.sourceValidationPath === undefined
  )
    throw new Error("Runtime source authority paths are required");
  const expectedSource = await buildCampaignSource(input);
  const validationInput = {
    sourcePath: input.sourcePath,
    receiptPath: input.sourceValidationPath,
    expectedSource,
  };
  const created =
    mode === "create"
      ? await writeRuntimeSourceValidationReceipt(validationInput)
      : undefined;
  const expectedReceiptFileSha256 =
    created?.receiptFileSha256 ?? input.sourceValidationFileSha256;
  if (expectedReceiptFileSha256 === undefined)
    throw new Error(
      "Runtime source check requires RUNTIME_SWEEP_SOURCE_VALIDATION_SHA256",
    );
  const result =
    created ??
    (await assertValidatedRuntimeSource({
      ...validationInput,
      expectedReceiptFileSha256,
    }));
  console.log(
    `runtime-source-validation PASS mode=${mode} source=${result.receipt.sourceSha} receipt=${result.receipt.receiptDigest} receipt-file-sha256=${expectedReceiptFileSha256}`,
  );
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  void validateRuntimeSourceCli(process.argv[2]).catch((error: unknown) => {
    console.error("[runtime-source-validation] Failed:", error);
    process.exitCode = 1;
  });
