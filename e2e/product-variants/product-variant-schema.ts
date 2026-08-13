import { z } from "zod";

import {
  HISTORICAL_RECONCILIATION,
  HISTORICAL_RECONCILIATION_VARIANT_IDS,
  historicalReconciliationSchema,
} from "./product-variant-reconciliation.ts";
import { CURRENT_CATALOG_ROLES } from "./product-variant-source.ts";

export {
  HISTORICAL_RECONCILIATION,
  HISTORICAL_RECONCILIATION_VARIANT_IDS,
  historicalReconciliationSchema,
};
export type { ProductVariantHistoricalReconciliation } from "./product-variant-reconciliation.ts";

export const ALL_CURRENT = "all-current" as const;
export const ROUTE_VARIANT = "route" as const;
export const CONTROL_FAMILY_VARIANT = "control-family" as const;
export const VARIANT_KINDS = [ROUTE_VARIANT, CONTROL_FAMILY_VARIANT] as const;
export const ACTION_VALUES = [
  "none",
  "click",
  "fill",
  "select",
  "navigate",
  "stateful",
] as const;
export const DISPLAY_VALUES = [
  "route-entry",
  "control-family",
  "reveal-family",
] as const;
export const TERMINAL_VALUES = [
  "PENDING_MANUAL_REVIEW",
  "PASS",
  "BLOCKED",
] as const;
export const MANUAL_REVIEW_VALUES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
] as const;
export const READ_BACK_VALUES = [
  "REQUIRED",
  "PASS",
  "NOT_REQUIRED",
  "FAIL",
] as const;
export const PROFILE_VALUES = ["minimal", "demo", "full", "stress"] as const;
export const ROLE_VALUES = [...CURRENT_CATALOG_ROLES, ALL_CURRENT] as const;

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const digestSchema = z.string().regex(DIGEST_PATTERN);
const shaSchema = z.string().regex(SOURCE_SHA_PATTERN);
const sourceFileSchema = z
  .object({ path: z.string().min(1), digest: digestSchema })
  .strict();
const catalogRouteSchema = z
  .object({
    route: z.string().min(1),
    access: z.array(z.string().min(1)).readonly(),
    landing: z.string().min(1).optional(),
    intentIds: z.array(z.string().min(1)).readonly(),
    digest: digestSchema,
  })
  .strict();
const catalogSchema = z
  .object({
    path: z.string().min(1),
    role: z.enum(CURRENT_CATALOG_ROLES),
    digest: digestSchema,
    routes: z.array(catalogRouteSchema).readonly(),
  })
  .strict();
const declaredFamilySchema = z
  .object({
    controlRole: z.string().min(1),
    formKind: z.enum(["fill", "select", "none"]),
    action: z.enum(["fill", "select", "click"]),
  })
  .strict();
const revealFamilySchema = z
  .object({
    revealKind: z.string().min(1),
    memberControlRoles: z.array(z.string().min(1)).readonly(),
    action: z.enum(ACTION_VALUES),
  })
  .strict();
const routeIdentitySchema = z
  .object({
    role: z.enum(CURRENT_CATALOG_ROLES),
    route: z.string().min(1),
    sourcePath: z.string().min(1),
    sourceDigest: digestSchema,
    catalogPath: z.string().min(1),
    catalogDigest: digestSchema,
    catalogRouteDigest: digestSchema,
    intentIds: z.array(z.string().min(1)).readonly(),
  })
  .strict();
const evidencePolicySchema = z
  .object({
    statefulReadBackRequired: z.boolean(),
    screenshot: z.object({ before: z.boolean(), after: z.boolean() }).strict(),
    a11y: z.boolean(),
    geometry: z.boolean(),
    logs: z.boolean(),
    metrics: z.boolean(),
    manualVisualReviewRequired: z.boolean(),
  })
  .strict();
const terminalEvidenceSchema = z
  .object({
    before: z.array(z.string().min(1)).readonly(),
    after: z.array(z.string().min(1)).readonly(),
    a11y: z.array(z.string().min(1)).readonly(),
    geometry: z.array(z.string().min(1)).readonly(),
    logs: z.array(z.string().min(1)).readonly(),
    metrics: z.array(z.string().min(1)).readonly(),
    readBack: z.array(z.string().min(1)).readonly(),
    manualVisualReview: z.string().min(1).nullable(),
  })
  .strict();
const terminalSchema = z
  .object({
    status: z.enum(TERMINAL_VALUES),
    manualVisualReview: z.enum(MANUAL_REVIEW_VALUES),
    readBack: z.enum(READ_BACK_VALUES),
    evidence: terminalEvidenceSchema,
  })
  .strict();
const controlFamilyIdentitySchema = z
  .object({
    kind: z.enum(["declared", "reveal"]),
    controlRole: z.string().min(1).nullable(),
    revealKind: z.string().min(1).nullable(),
    memberControlRoles: z.array(z.string().min(1)).readonly(),
  })
  .strict();
const variantSchema = z
  .object({
    id: z.string().min(1),
    identityKey: z.string().min(1),
    kind: z.enum(VARIANT_KINDS),
    profile: z.literal(ALL_CURRENT),
    role: z.enum(ROLE_VALUES),
    route: z.string().min(1),
    stateVariant: z.string().min(1),
    actionVariant: z.enum(ACTION_VALUES),
    displayVariant: z.enum(DISPLAY_VALUES),
    routeIdentity: routeIdentitySchema.nullable(),
    controlFamily: controlFamilyIdentitySchema.nullable(),
    sourceFiles: z.array(sourceFileSchema).min(1).readonly(),
    catalogRouteKeys: z.array(z.string().min(1)).min(1).readonly(),
    evidencePolicy: evidencePolicySchema,
    terminal: terminalSchema,
  })
  .strict();

export const manifestSchema = z
  .object({
    artifact: z.literal("PRODUCT_VARIANT_MANIFEST"),
    schemaVersion: z.literal(1),
    sourceSha: shaSchema,
    sourceTree: shaSchema,
    sourceDigest: digestSchema,
    catalogDigest: digestSchema,
    sourceFiles: z.array(sourceFileSchema).min(1).readonly(),
    catalogs: z
      .array(catalogSchema)
      .length(CURRENT_CATALOG_ROLES.length)
      .readonly(),
    profiles: z.array(z.string().min(1)).min(1).readonly(),
    declaredControlFamilies: z.array(declaredFamilySchema).min(1).readonly(),
    revealFamilies: z.array(revealFamilySchema).min(1).readonly(),
    historicalReconciliation: historicalReconciliationSchema,
    summary: z
      .object({
        roleRouteCount: z.number().int().nonnegative(),
        intentCount: z.number().int().nonnegative(),
        routeVariantCount: z.number().int().nonnegative(),
        declaredControlVariantCount: z.number().int().nonnegative(),
        revealFamilyVariantCount: z.number().int().nonnegative(),
        totalVariantCount: z.number().int().nonnegative(),
      })
      .strict(),
    variants: z.array(variantSchema).min(1).readonly(),
    generatedAt: z.iso.datetime(),
    manifestDigest: digestSchema,
  })
  .strict();

export type ProductVariantManifest = z.infer<typeof manifestSchema>;
export type ProductVariant = ProductVariantManifest["variants"][number];
export type ActionVariant = (typeof ACTION_VALUES)[number];

export type ProductVariantValidation = Readonly<{
  readonly valid: boolean;
  readonly status: "PASS" | "PENDING_MANUAL_REVIEW" | "BLOCKED";
  readonly issues: readonly string[];
}>;

export class ProductVariantManifestError extends Error {
  override readonly name = "ProductVariantManifestError";
}
