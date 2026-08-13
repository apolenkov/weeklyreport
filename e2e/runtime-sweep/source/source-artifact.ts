import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { CampaignMatrixPlan } from "../matrix/campaign-matrix.ts";
import {
  assertSpecializedDeclarations,
  SPECIALIZED_DECLARATION_COUNT,
} from "../matrix/specialized/specialized-declarations.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import {
  actionOperationSchema,
  actionSafetySchema,
  campaignManifestSchema,
  controlTransitionSchema,
  faultModeSchema,
  matrixAxesSchema,
  matrixConstraintIdSchema,
  resolverOutcomeKindSchema,
  roleSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceCapacitySchema,
  stableIdentifierSchema,
} from "./contracts.ts";
import { freezeDeep, writeManifestFile } from "./manifest-source.ts";

const campaignMatrixStateSchema = z
  .object({
    stateId: stableIdentifierSchema,
    pairwiseDigest: sha256DigestSchema,
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
  })
  .strict();

const campaignMatrixInapplicableSchema = z
  .object({
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
    constraintId: matrixConstraintIdSchema,
    reason: z.string().trim().min(1),
  })
  .strict();

export const campaignMatrixPlanSchema = z
  .object({
    states: z.array(campaignMatrixStateSchema).readonly(),
    inapplicable: z.array(campaignMatrixInapplicableSchema).readonly(),
    digest: sha256DigestSchema,
  })
  .strict();

const specializedProofSchema = z
  .object({
    testFile: z.string().min(1),
    testName: z.string().min(1),
    target: z.string().min(1),
  })
  .strict();

const specializedDeclarationBaseSchema = z
  .object({
    declarationId: stableIdentifierSchema,
    kind: z.enum(["http-fault", "stale-concurrency", "infrastructure"]),
    faultId: stableIdentifierSchema,
    faultMode: faultModeSchema.refine((value) => value !== "none"),
    executionKind: z.enum(["fault", "concurrency", "infrastructure"]),
    profile: seedProfileSchema,
    role: roleSchema,
    catalogRoute: z.string().min(1),
    proof: specializedProofSchema,
  })
  .strict();

const specializedActionDeclarationSchema = specializedDeclarationBaseSchema
  .extend({
    executionKind: z.enum(["fault", "concurrency"]),
    operation: actionOperationSchema,
    safety: actionSafetySchema,
    transition: controlTransitionSchema,
  })
  .strict();

const specializedObservationDeclarationSchema = specializedDeclarationBaseSchema
  .extend({
    executionKind: z.literal("infrastructure"),
    observationKind: z.enum(["db", "api"]),
  })
  .strict();

const resolverSpecializedDeclarationSchema = z
  .object({
    declarationId: z.enum(["viewer-status-empty", "viewer-status-query-error"]),
    kind: z.literal("resolver"),
    outcome: resolverOutcomeKindSchema.refine(
      (value) => value === "empty" || value === "query-error",
    ),
    recoveryOutcome: resolverOutcomeKindSchema
      .refine((value) => value === "empty" || value === "visible-current")
      .nullable(),
    faultId: stableIdentifierSchema.nullable(),
    faultMode: z.enum(["none", "api-error"]),
    executionKind: z.enum(["navigation", "fault"]),
    profile: z.literal("demo"),
    role: z.literal("viewer"),
    catalogRoute: z.literal("/reports/latest"),
    operation: z.literal("navigate"),
    safety: z.literal("read-only"),
    transition: z.literal("none"),
    resolverOperation: z.literal("reports.latestForViewer"),
    proof: specializedProofSchema,
  })
  .strict()
  .superRefine((declaration, context) => {
    if (
      declaration.outcome === "empty" &&
      (declaration.faultId !== null ||
        declaration.faultMode !== "none" ||
        declaration.executionKind !== "navigation")
    ) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message:
          "Empty resolver declarations are navigation-only and fault-free",
      });
    }
    if (
      declaration.outcome === "query-error" &&
      (declaration.faultId === null ||
        declaration.faultMode !== "api-error" ||
        declaration.executionKind !== "fault" ||
        declaration.recoveryOutcome !== "visible-current")
    ) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message:
          "Query-error resolver declarations require one api-error fault",
      });
    }
  });

export const specializedDeclarationSchema = z.union([
  specializedActionDeclarationSchema,
  specializedObservationDeclarationSchema,
  resolverSpecializedDeclarationSchema,
]);

const sourceFieldsSchema = campaignManifestSchema.omit({ matrixDigest: true });

export const sourceArtifactSchema = z
  .object({
    artifact: z.literal("SOURCE"),
    version: z.literal(2),
    ...sourceFieldsSchema.shape,
    matrixLimits: sourceCapacitySchema,
    plan: campaignMatrixPlanSchema,
    specializedDeclarations: z
      .array(specializedDeclarationSchema)
      .length(SPECIALIZED_DECLARATION_COUNT)
      .readonly(),
    sourceDigest: sha256DigestSchema,
  })
  .strict();

export type CampaignMatrixPlanArtifact = z.infer<
  typeof campaignMatrixPlanSchema
>;
export type SourceArtifact = z.infer<typeof sourceArtifactSchema>;

export class SourceArtifactError extends Error {
  override readonly name = "SourceArtifactError";
}

const bodyForDigest = (
  artifact: SourceArtifact,
): Omit<SourceArtifact, "sourceDigest"> => {
  const { sourceDigest: _sourceDigest, ...body } = artifact;
  return body;
};

export function parseSourceArtifact(value: unknown): SourceArtifact {
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1
  ) {
    throw new SourceArtifactError(
      "SOURCE.json version 1 is legacy and cannot launch; regenerate a version 2 source artifact",
    );
  }
  const parsed = sourceArtifactSchema.parse(value);
  assertSpecializedDeclarations(parsed.specializedDeclarations);
  if (sha256Hex(bodyForDigest(parsed)) !== parsed.sourceDigest)
    throw new SourceArtifactError("SOURCE.json digest does not match contents");
  if ("matrixDigest" in parsed)
    throw new SourceArtifactError("SOURCE.json must not contain matrixDigest");
  return freezeDeep(parsed);
}

export const serializeSourceArtifact = (artifact: SourceArtifact): string =>
  `${stableSerialize(parseSourceArtifact(artifact))}\n`;

export async function readSourceArtifact(
  filePath: string,
): Promise<SourceArtifact> {
  try {
    return parseSourceArtifact(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error: unknown) {
    if (error instanceof SourceArtifactError) throw error;
    throw new SourceArtifactError(
      `Cannot read SOURCE.json: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
}

export async function writeSourceArtifact(
  filePath: string,
  artifact: SourceArtifact,
): Promise<void> {
  await writeManifestFile(filePath, serializeSourceArtifact(artifact));
}

export const sourcePlan = (source: SourceArtifact): CampaignMatrixPlan =>
  source.plan;
