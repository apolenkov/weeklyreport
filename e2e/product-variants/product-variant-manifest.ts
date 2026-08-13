import {
  generateProductVariantManifest,
  productVariantProfiles,
} from "./product-variant-generator.ts";
import {
  type ProductVariant,
  type ProductVariantManifest,
  ProductVariantManifestError,
  type ProductVariantValidation,
} from "./product-variant-schema.ts";
import {
  type ProductVariantGitCommand,
  readProductVariantSource,
} from "./product-variant-source.ts";
import {
  assertProductVariantManifest,
  validateProductVariantManifest,
} from "./product-variant-validator.ts";

export {
  assertProductVariantManifest,
  generateProductVariantManifest,
  ProductVariantManifestError,
  productVariantProfiles,
  validateProductVariantManifest,
};
export type {
  ProductVariant,
  ProductVariantManifest,
  ProductVariantValidation,
};

export async function readAndGenerateProductVariantManifest(
  repoRoot: string,
  generatedAt?: string,
  runCommand?: ProductVariantGitCommand,
): Promise<ProductVariantManifest> {
  const source = await readProductVariantSource(repoRoot, runCommand);
  const manifest = generateProductVariantManifest(source, generatedAt);
  assertProductVariantManifest(manifest, source);
  return manifest;
}

export const serializeProductVariantManifest = (
  manifest: ProductVariantManifest,
): string => `${JSON.stringify(manifest, null, 2)}\n`;
