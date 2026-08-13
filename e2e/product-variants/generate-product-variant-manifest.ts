import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readAndGenerateProductVariantManifest,
  serializeProductVariantManifest,
} from "./product-variant-manifest.ts";

const outputVariable = "PRODUCT_VARIANT_MANIFEST_OUTPUT";

const outputPathFor = (repoRoot: string): string => {
  const configured = process.env[outputVariable];
  if (configured === undefined || configured.trim() === "") {
    throw new Error(`${outputVariable} must point to an external archive path`);
  }
  const outputPath = path.resolve(repoRoot, configured);
  const relative = path.relative(repoRoot, outputPath);
  const isInsideRepository =
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));
  if (isInsideRepository) {
    throw new Error(`${outputVariable} must be outside the repository`);
  }
  return outputPath;
};

export async function generateProductVariantManifestFile(
  repoRoot = process.cwd(),
): Promise<string> {
  const root = path.resolve(repoRoot);
  const outputPath = outputPathFor(root);
  const manifest = await readAndGenerateProductVariantManifest(root);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeProductVariantManifest(manifest), {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      status: "PENDING_MANUAL_REVIEW",
      outputPath,
      sourceSha: manifest.sourceSha,
      sourceTree: manifest.sourceTree,
      summary: manifest.summary,
    }),
  );
  return outputPath;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await generateProductVariantManifestFile().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
