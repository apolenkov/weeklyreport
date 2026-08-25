import * as path from "node:path";

import { z } from "zod";

import { RUNTIME_LANE_IDS } from "../../../lanes/resources/runtime-lane-resources.ts";
import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
  viewportSchema,
} from "../../../source/contracts.ts";

export const PREFLIGHT_SHARD_RESOURCE_PROOF =
  "PREFLIGHT_SHARD_RESOURCE_PROOF" as const;
export const PREFLIGHT_SHARD_RESOURCE_PROOF_VERSION = 1 as const;

/**
 * A local port may be reused by equal donors on separate machines. The
 * planner still rejects all collisions within one donor, while filesystem
 * paths and canonical archive destinations are global because they share the
 * host filesystem.
 */
export const PREFLIGHT_RESOURCE_COLLISION_SCOPE = "donor-local" as const;

export const PREFLIGHT_RESOURCE_REQUIRED_GUARD =
  "prisma/guards/_destructive-guard.ts" as const;
export const PREFLIGHT_RESOURCE_REQUIRED_CONSENT =
  "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION" as const;
export const PREFLIGHT_RESOURCE_REQUIRED_REDIS_AUTHORIZATION =
  "RUNTIME_SWEEP_REDIS_RECREATE" as const;

const PREFLIGHT_DISPOSABLE_DATABASE_NAMES = Object.freeze([
  "customreport_e2e",
  ...RUNTIME_LANE_IDS.map((laneId) => `customreport_e2e_lane_${laneId}_test`),
]);

const MIN_TCP_PORT = 1024;
const MAX_TCP_PORT = 65_535;
const MAX_IDENTIFIER_LENGTH = 160;
const MAX_DONOR_ID_LENGTH = 80;
const donorIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._+:-]*$/u;
const queuePrefixPattern = /^[a-z0-9][a-z0-9._:-]*$/u;
const nodeVersionPattern =
  /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const numericVersionPattern =
  /^\d+(?:\.\d+){2,3}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const chromiumRevisionPattern = /^(?:\d{4,}|chromium-\d{4,})$/u;
const nonZeroVersion = (value: string): boolean =>
  !/^v?0+(?:\.0+){2,3}(?:$|[-+])/u.test(value);

const portSchema = z.number().int().min(MIN_TCP_PORT).max(MAX_TCP_PORT);

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_IDENTIFIER_LENGTH)
  .regex(identifierPattern, "must be a version or runtime identifier");

const nodeVersionSchema = z
  .string()
  .regex(nodeVersionPattern, "must be a v-prefixed semantic version")
  .refine(nonZeroVersion, "must not be a zero or placeholder version");

const numericVersionSchema = z
  .string()
  .regex(numericVersionPattern, "must be a numeric semantic version")
  .refine(nonZeroVersion, "must not be a zero or placeholder version");

const chromiumRevisionSchema = z
  .string()
  .regex(
    chromiumRevisionPattern,
    "must be a numeric Chromium revision or chromium-<digits>",
  )
  .refine((value) => !/^0+(?:\.0+)*$/u.test(value.replace(/^chromium-/u, "")), {
    message: "must not be a zero or placeholder Chromium revision",
  });

const browserNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_IDENTIFIER_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._+:-]*$/u, "must be a redacted browser name");

const pathSchema = z
  .string()
  .min(1)
  .refine((value) => path.isAbsolute(value), "must be an absolute path")
  .refine(
    (value) => path.resolve(value) === value,
    "must be a normalized absolute path",
  )
  .refine(
    (value) => !value.split(path.sep).includes(".."),
    "must not contain parent traversal",
  )
  .refine(
    (value) => path.resolve(value) !== path.parse(value).root,
    "must not be a filesystem root",
  );

export const resourceProofDonorIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DONOR_ID_LENGTH)
  .regex(donorIdPattern, "must be a stable donor identifier");

export const resourceProofPathSchema = pathSchema;

/** Returns the conservative host-filesystem identity used for path collisions. */
export const resourceProofPathIdentity = (value: string): string =>
  path.resolve(value).normalize("NFC").toLowerCase();

const databaseNameSchema = z
  .string()
  .refine(
    (value) => PREFLIGHT_DISPOSABLE_DATABASE_NAMES.includes(value),
    "must be one of the exact disposable runtime databases",
  );

const databaseIdentitySchema = z
  .object({
    database: databaseNameSchema,
    host: z.literal("loopback"),
    port: portSchema,
  })
  .strict();

const redisIdentitySchema = z
  .object({
    host: z.literal("127.0.0.1"),
    port: portSchema,
    runId: stableIdentifierSchema,
  })
  .strict();

const localEndpointSchema = z
  .object({
    host: z.literal("127.0.0.1"),
    port: portSchema,
  })
  .strict();

const databaseResourceSchema = z
  .object({
    name: databaseNameSchema,
    identity: databaseIdentitySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.identity.database !== value.name)
      context.addIssue({
        code: "custom",
        path: ["identity", "database"],
        message: "database identity must match the declared database name",
      });
  });

const resourcesSchema = z
  .object({
    database: databaseResourceSchema,
    redis: redisIdentitySchema,
    api: localEndpointSchema,
    web: localEndpointSchema,
    nextDistDir: pathSchema,
    queuePrefix: z
      .string()
      .trim()
      .min(1)
      .max(MAX_IDENTIFIER_LENGTH)
      .regex(queuePrefixPattern, "must be a redacted queue namespace"),
    logDir: pathSchema,
    pdfDir: pathSchema,
    outputDir: pathSchema,
    archiveRoot: pathSchema,
  })
  .strict();

const browserSchema = z
  .object({
    project: identifierSchema,
    name: browserNameSchema,
    version: numericVersionSchema,
    viewport: viewportSchema,
  })
  .strict();

const runtimeSchema = z
  .object({
    nodeVersion: nodeVersionSchema,
    pnpmVersion: numericVersionSchema,
    playwrightVersion: numericVersionSchema,
    chromiumRevision: chromiumRevisionSchema,
  })
  .strict();

const capabilitiesSchema = z
  .object({
    destructiveOperationsAllowed: z.literal(false),
    requiredFutureGuard: z.literal(PREFLIGHT_RESOURCE_REQUIRED_GUARD),
    requiredFutureConsent: z.literal(PREFLIGHT_RESOURCE_REQUIRED_CONSENT),
    requiredFutureRedisAuthorization: z.literal(
      PREFLIGHT_RESOURCE_REQUIRED_REDIS_AUTHORIZATION,
    ),
  })
  .strict();

const resourceProofBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_SHARD_RESOURCE_PROOF),
    version: z.literal(PREFLIGHT_SHARD_RESOURCE_PROOF_VERSION),
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    logicalShardId: stableIdentifierSchema,
    shardIndex: z.number().int().nonnegative(),
    shardDigest: sha256DigestSchema,
    donorId: resourceProofDonorIdSchema,
    donorRoot: pathSchema,
    shardAttemptId: stableIdentifierSchema,
    collisionScope: z.literal(PREFLIGHT_RESOURCE_COLLISION_SCOPE),
    browser: browserSchema,
    runtime: runtimeSchema,
    resources: resourcesSchema,
    capabilities: capabilitiesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.browser.version === value.runtime.playwrightVersion)
      context.addIssue({
        code: "custom",
        path: ["browser", "version"],
        message: "must identify the browser, not the Playwright package",
      });
    const revision = value.runtime.chromiumRevision.replace(/^chromium-/u, "");
    if (
      revision === String(value.browser.viewport.width) ||
      revision === String(value.browser.viewport.height)
    )
      context.addIssue({
        code: "custom",
        path: ["runtime", "chromiumRevision"],
        message: "must not be derived from the browser viewport",
      });
  });

export const preflightShardResourceProofSchema = resourceProofBodySchema
  .extend({ proofDigest: sha256DigestSchema })
  .strict();

export type PreflightShardResourceProof = z.infer<
  typeof preflightShardResourceProofSchema
>;
export type PreflightShardResourceProofBody = z.infer<
  typeof resourceProofBodySchema
>;
export type PreflightShardResourceProofResources = z.infer<
  typeof resourcesSchema
>;
export type PreflightShardResourceProofBrowser = z.infer<typeof browserSchema>;
export type PreflightShardResourceProofRuntime = z.infer<typeof runtimeSchema>;
export class PreflightShardResourceProofError extends Error {
  override readonly name = "PreflightShardResourceProofError";
}
