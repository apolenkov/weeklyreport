import { z } from "zod";

import { createRuntimeRouteSchemas } from "./contracts-route-schemas.ts";
import { routeNetworkPolicySchema } from "./network-policy-contracts.ts";
export * from "./network-policy-contracts.ts";
const tuple = <const T extends readonly [string, ...string[]]>(
  ...values: T
): Readonly<T> => Object.freeze(values);
export const CANONICAL_ROLES = tuple("lead", "head", "admin", "viewer");
export const SEED_PROFILES = tuple("minimal", "demo", "full", "stress");
export const ROUTE_KINDS = tuple("unconditional", "resolver");
export const RESOLVER_KEYS = tuple("viewer-status");
export const RESOLVER_OUTCOME_KINDS = tuple(
  "visible-current",
  "published-fallback",
  "empty",
  "query-error",
  "anonymous",
);
// prettier-ignore
export const SEED_CAPABILITIES = tuple("admin-examples", "archive-flow", "canonical-identities", "deep-history", "editable-active-report", "foreign-content", "health-states", "multi-role-access", "ownership", "policy-examples", "project-activities", "publish-flow", "published-period", "reminders", "reopen-flow", "stress-volume", "submission-contrast");
export const SEED_COUNT_DIMENSIONS = tuple(
  "users",
  "projects",
  "reports",
  "sections",
  "items",
);
// prettier-ignore
export const LIFECYCLE_STATES = tuple("open", "reopened", "published", "archived");
// prettier-ignore
export const SUBMISSION_STATES = tuple("draft", "submitted", "rejected", "approved");
export const OWNERSHIP_DENSITIES = tuple("none", "single", "multiple");
// prettier-ignore
export const PERMISSION_BOUNDARIES = tuple("allowed", "owner", "non-owner", "head", "admin", "viewer", "anonymous", "forbidden");
// prettier-ignore
export const FAULT_MODES = tuple("none", "auth-missing", "auth-expired", "auth-forbidden", "network-timeout", "request-aborted", "http-4xx", "http-5xx", "api-error", "concurrency-stale-version", "infrastructure-unavailable");
export const MATRIX_EXECUTION_KINDS = tuple(
  "navigation",
  "idle",
  "control",
  "recovery",
  "fault",
  "concurrency",
  "infrastructure",
);
// prettier-ignore
export const CONTROL_TRANSITIONS = tuple("none", "idle", "open", "submit", "publish", "delete", "revoke", "restore", "retry", "cancel");
// prettier-ignore
export const ACTION_OPERATIONS = tuple("navigate", "click", "fill", "select", "submit", "publish", "delete", "revoke", "restore", "retry");
export const ACTION_SAFETY = tuple("read-only", "reversible", "irreversible");
export const STATE_KINDS = tuple(
  "nominal",
  "boundary",
  "lifecycle",
  "permission",
  "fault",
);
export const EVIDENCE_DIMENSIONS = tuple(
  "function",
  "accessibility",
  "visual",
  "runtime",
);
// prettier-ignore
export const EVIDENCE_KINDS = tuple("dom", "url", "console", "page-error", "request", "api", "db", "log", "axe", "keyboard", "screenshot", "geometry", "control-action", "driver-report");
export const CANDIDATE_KINDS = tuple(
  "functional",
  "accessibility",
  "visual",
  "console",
  "network",
  "page",
  "env",
);
export const COVERAGE_VERDICTS = tuple(
  "pending",
  "candidate",
  "confirmed",
  "pass",
  "fail",
  "blocked",
  "excluded",
);
export const OBSERVATION_KINDS = tuple(
  "console",
  "page-error",
  "network",
  "api",
  "db",
  "keyboard",
  "geometry",
  "axe",
);
export const OBSERVATION_OUTCOMES = tuple("pass", "fail", "not-applicable");
export const CONTROL_RESULT_VALUES = tuple("pass", "fail");
export const NOT_EXERCISED_POLICIES = tuple(
  "inapplicable",
  "unsafe",
  "unavailable",
);
export const EXCLUSION_SCOPES = tuple("browser", "viewport", "matrix");
const DESKTOP_WIDTH = 1440;
const DESKTOP_HEIGHT = 900;
const gitObjectShaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const stableIdentifierPattern = /^[a-z0-9][a-z0-9._-]*$/;
const routeValuePattern = /^\/(?!\/)[^\s#]*$/u;
const stableIdentifierSchemaFactory = () =>
  z
    .string()
    .regex(stableIdentifierPattern, "must be a lowercase stable identifier");
export const sourceShaSchema = z.string().regex(gitObjectShaPattern);
export const sourceTreeSchema = z.string().regex(gitObjectShaPattern);
export const sha256DigestSchema = z.string().regex(digestPattern);
export const routeUrlSchema = z
  .string()
  .regex(routeValuePattern, "must be a relative path URL without a fragment");
export const landingRouteSchema = z
  .string()
  .regex(routeValuePattern, "must be a relative path URL without a fragment");
export const roleSchema = z.enum(CANONICAL_ROLES);
export const seedProfileSchema = z.enum(SEED_PROFILES);
export const routeKindSchema = z.enum(ROUTE_KINDS);
export const resolverKeySchema = z.enum(RESOLVER_KEYS);
export const resolverOutcomeKindSchema = z.enum(RESOLVER_OUTCOME_KINDS);
export const seedCapabilitySchema = z.enum(SEED_CAPABILITIES);
export const lifecycleStateSchema = z.enum(LIFECYCLE_STATES);
export const submissionStateSchema = z.enum(SUBMISSION_STATES);
export const ownershipDensitySchema = z.enum(OWNERSHIP_DENSITIES);
export const permissionBoundarySchema = z.enum(PERMISSION_BOUNDARIES);
export const faultModeSchema = z.enum(FAULT_MODES);
export const matrixExecutionKindSchema = z.enum(MATRIX_EXECUTION_KINDS);
export const stableIdentifierSchema = stableIdentifierSchemaFactory();
export const faultIdSchema = stableIdentifierSchemaFactory();
export const matrixConstraintIdSchema = stableIdentifierSchemaFactory();
export const controlTransitionSchema = z.enum(CONTROL_TRANSITIONS);
export const actionOperationSchema = z.enum(ACTION_OPERATIONS);
export const actionSafetySchema = z.enum(ACTION_SAFETY);
export const stateKindSchema = z.enum(STATE_KINDS);
export const evidenceDimensionSchema = z.enum(EVIDENCE_DIMENSIONS);
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
export const candidateKindSchema = z.enum(CANDIDATE_KINDS);
export const coverageVerdictSchema = z.enum(COVERAGE_VERDICTS);
// prettier-ignore
export const seedCountBoundSchema = z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).strict().refine(({ min, max }) => min <= max, "seed count minimum cannot exceed maximum");
// prettier-ignore
export const seedProfileDefinitionSchema = z.object({ purpose: z.string().min(1), capabilities: z.array(seedCapabilitySchema).min(1).readonly(), stableIds: z.record(z.string().min(1), z.string().min(1)), counts: z.object({ users: seedCountBoundSchema, projects: seedCountBoundSchema, reports: seedCountBoundSchema, sections: seedCountBoundSchema, items: seedCountBoundSchema }).strict() }).strict();
// prettier-ignore
export const seedProfileBindingSchema = z.object({ profile: seedProfileSchema, definition: seedProfileDefinitionSchema, digest: sha256DigestSchema }).strict();
// prettier-ignore
export const toolVersionsSchema = z.record(z.string().min(1), z.string().min(1)).refine((versions) => Object.keys(versions).length > 0, "at least one tool version is required");
// prettier-ignore
export const matrixConstraintSchema = z.object({ id: matrixConstraintIdSchema, reason: z.string().trim().min(1) }).strict();
// prettier-ignore
export const matrixDeclarationSchema = z.object({ generatorSeed: z.string().min(1), axes: z.object({ role: z.array(roleSchema).min(1).readonly(), route: z.array(z.string().min(1)).min(1).readonly(), profileCapability: z.array(seedCapabilitySchema).min(1).readonly(), lifecycle: z.array(lifecycleStateSchema).min(1).readonly(), submission: z.array(submissionStateSchema).min(1).readonly(), ownershipDensity: z.array(ownershipDensitySchema).min(1).readonly(), permission: z.array(permissionBoundarySchema).min(1).readonly(), fault: z.array(faultModeSchema).min(1).readonly(), controlTransition: z.array(controlTransitionSchema).min(1).readonly() }).strict(), constraints: z.array(matrixConstraintSchema).readonly() }).strict();
// prettier-ignore
export const viewportSchema = z.object({ browser: z.literal("chromium"), width: z.literal(DESKTOP_WIDTH), height: z.literal(DESKTOP_HEIGHT) }).strict();
// prettier-ignore
export const stateAxesSchema = z.object({ profileCapability: seedCapabilitySchema, lifecycle: lifecycleStateSchema, submission: submissionStateSchema, ownershipDensity: ownershipDensitySchema, permission: permissionBoundarySchema, fault: faultModeSchema, controlTransition: controlTransitionSchema }).strict();
// prettier-ignore
export const matrixAxesSchema = z.object({ role: roleSchema, route: z.string().min(1), ...stateAxesSchema.shape }).strict();
// prettier-ignore
export const actionTargetSchema = z.object({ role: z.literal("link"), href: z.string().min(1) }).strict();
const actionShape = {
  intentId: z.string().min(1).optional(),
  controlKey: z.string().min(1),
  operation: actionOperationSchema,
  safety: actionSafetySchema,
  transition: controlTransitionSchema,
  target: actionTargetSchema.optional(),
} as const;
// prettier-ignore
export const actionSchema = z.object(actionShape).strict().superRefine((action, context) => {
  if (action.target !== undefined && action.operation !== "click") context.addIssue({ code: "custom", path: ["target"], message: "Stable link targets are valid only for click actions" });
});
export const matrixObservationSchema = z
  .object({
    observationId: stableIdentifierSchema,
    kind: z.enum(OBSERVATION_KINDS),
  })
  .strict();
const navigationActionSchema = z
  .object({
    ...actionShape,
    operation: z.literal("navigate"),
    safety: z.literal("read-only"),
    transition: z.literal("none"),
    target: z.never().optional(),
  })
  .strict();
const recoveryActionSchema = z
  .object({
    ...actionShape,
    operation: z.literal("retry"),
    transition: z.literal("retry"),
    target: z.never().optional(),
  })
  .strict();
const faultExecutionBaseSchema = z.object({ faultId: faultIdSchema });
const navigationExecutionSchema = z
  .object({ kind: z.literal("navigation"), action: navigationActionSchema })
  .strict();
const idleExecutionSchema = z
  .object({ kind: z.literal("idle"), observation: matrixObservationSchema })
  .strict();
const controlExecutionSchema = z
  .object({ kind: z.literal("control"), action: actionSchema })
  .strict();
const recoveryExecutionSchema = z
  .object({
    kind: z.literal("recovery"),
    action: recoveryActionSchema,
    ...faultExecutionBaseSchema.shape,
  })
  .strict();
const faultExecutionSchema = z
  .object({
    kind: z.literal("fault"),
    action: actionSchema,
    ...faultExecutionBaseSchema.shape,
  })
  .strict();
const concurrencyExecutionSchema = z
  .object({
    kind: z.literal("concurrency"),
    action: actionSchema,
    ...faultExecutionBaseSchema.shape,
  })
  .strict();
const infrastructureActionExecutionSchema = z
  .object({
    kind: z.literal("infrastructure"),
    action: actionSchema,
    ...faultExecutionBaseSchema.shape,
  })
  .strict();
const infrastructureObservationExecutionSchema = z
  .object({
    kind: z.literal("infrastructure"),
    observation: matrixObservationSchema
      .extend({ kind: z.enum(["api", "db"]) })
      .strict(),
    ...faultExecutionBaseSchema.shape,
  })
  .strict();
export const matrixExecutionSchema = z.union([
  navigationExecutionSchema,
  idleExecutionSchema,
  controlExecutionSchema,
  recoveryExecutionSchema,
  faultExecutionSchema,
  concurrencyExecutionSchema,
  infrastructureActionExecutionSchema,
  infrastructureObservationExecutionSchema,
]);
export const matrixInapplicableSchema = z
  .object({
    constraintId: matrixConstraintIdSchema,
    reason: z.string().trim().min(1),
  })
  .strict();
// prettier-ignore
export const oracleDimensionSchema = z.object({ required: z.boolean(), expectation: z.string().min(1) }).strict();
// prettier-ignore
export const oracleSchema = z.object({ domainSpecRefs: z.array(z.string().min(1)).min(1).readonly(), function: oracleDimensionSchema, accessibility: oracleDimensionSchema, visual: oracleDimensionSchema, runtime: oracleDimensionSchema }).strict();
// prettier-ignore
export const evidenceRefSchema = z.object({ artifactId: z.string().min(1), kind: evidenceKindSchema, dimension: evidenceDimensionSchema, archivePath: z.string().min(1), digest: sha256DigestSchema, capturedAt: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, profile: seedProfileSchema, role: roleSchema, catalogRoute: z.string().min(1), resolvedRoute: z.string().min(1) }).strict();
// prettier-ignore
export const evidenceObservationSchema = z.object({ observationId: z.string().min(1), kind: z.enum(OBSERVATION_KINDS), outcome: z.enum(OBSERVATION_OUTCOMES), message: z.string().min(1), evidenceIds: z.array(z.string().min(1)).readonly() }).strict();
// prettier-ignore
export const inapplicableEvidenceSchema = z.object({ dimension: evidenceDimensionSchema, reason: z.string().min(1) }).strict();
// prettier-ignore
export const evidenceBundleSchema = z.object({ before: z.array(evidenceRefSchema).readonly(), action: z.array(evidenceRefSchema).readonly(), after: z.array(evidenceRefSchema).readonly(), observations: z.array(evidenceObservationSchema).readonly(), inapplicable: z.array(inapplicableEvidenceSchema).readonly() }).strict();
// prettier-ignore
export const controlActionResultSchema = z.union([z.object({ kind: z.literal("exercised"), result: z.enum(CONTROL_RESULT_VALUES), evidenceIds: z.array(z.string().min(1)).min(1).readonly() }).strict(), z.object({ kind: z.literal("not-exercised"), policy: z.enum(NOT_EXERCISED_POLICIES), reason: z.string().min(1) }).strict()]);
// prettier-ignore
export const domControlSchema = z.object({ controlKey: z.string().min(1), cellId: z.string().min(1), ariaRole: z.string().min(1), accessibleName: z.string(), enabled: z.boolean(), order: z.number().int().nonnegative(), actionResult: controlActionResultSchema }).strict();
export const routeBindingTargetSchema = z.enum(["none", "active", "published"]);
const runtimeRouteSchemas = createRuntimeRouteSchemas({
  routeUrlSchema,
  landingRouteSchema,
  roleSchema,
  seedProfileSchema,
  routeBindingTargetSchema,
  resolverKeySchema,
  resolverOutcomeKindSchema,
  stableIdentifierSchema,
  sha256DigestSchema,
  matrixConstraintIdSchema,
  seedCapabilitySchema,
  routeNetworkPolicySchema,
  seedProfileCount: SEED_PROFILES.length,
  resolverOutcomeKinds: RESOLVER_OUTCOME_KINDS,
});
export const {
  resolverOutcomeIdentitySchema,
  sourceBoundResolverOutcomeSchema,
  resolverOutcomeInapplicableSchema,
  resolverOutcomeKindsSchema,
  routeBindingSchema,
  routeDeclarationSchema,
} = runtimeRouteSchemas;
// prettier-ignore
export const exclusionSchema = z.object({ id: z.string().min(1), scope: z.enum(EXCLUSION_SCOPES), target: z.string().min(1), reason: z.string().min(1) }).strict();
// prettier-ignore
export const campaignManifestSchema = z.object({ campaignId: z.string().min(1), sourceSha: sourceShaSchema, sourceTree: sourceTreeSchema, treeDigest: sha256DigestSchema, browser: z.literal("chromium"), viewport: viewportSchema, roles: z.array(roleSchema).length(CANONICAL_ROLES.length).readonly(), routes: z.array(routeDeclarationSchema).min(1).readonly(), profiles: z.array(seedProfileSchema).length(SEED_PROFILES.length).readonly(), seedProfiles: z.array(seedProfileBindingSchema).length(SEED_PROFILES.length).readonly(), stateKinds: z.array(stateKindSchema).length(STATE_KINDS.length).readonly(), actions: z.array(actionSchema).min(1).readonly(), toolVersions: toolVersionsSchema, catalogDigest: sha256DigestSchema, domainSpecDigest: sha256DigestSchema, matrixDeclaration: matrixDeclarationSchema, matrixDigest: sha256DigestSchema, exclusions: z.array(exclusionSchema).min(1).readonly() }).strict();
// prettier-ignore
const coverageCellBaseSchema = z.object({ cellId: z.string().min(1), sourceSha: sourceShaSchema, profile: seedProfileSchema, role: roleSchema, catalogRoute: z.string().min(1), resolvedRoute: z.string().min(1), viewport: viewportSchema, state: stateAxesSchema, action: actionSchema, execution: matrixExecutionSchema, faultId: faultIdSchema.nullable(), declarationId: stableIdentifierSchema.optional(), resolverOutcome: resolverOutcomeKindSchema.optional(), resolverRecoveryOutcome: resolverOutcomeKindSchema.nullable().optional(), oracle: oracleSchema, controls: z.array(domControlSchema).readonly(), evidence: evidenceBundleSchema, verdict: coverageVerdictSchema }).strict();
// prettier-ignore
export const coverageCellSchema = coverageCellBaseSchema.refine(({ execution, faultId }) => faultId === ("faultId" in execution ? execution.faultId : null), { path: ["faultId"], message: "CoverageCell faultId must match execution faultId" });
// prettier-ignore
export const candidateSchema = z.object({ candidateId: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, profile: seedProfileSchema, role: roleSchema, catalogRoute: z.string().min(1), resolvedRoute: z.string().min(1), state: stateAxesSchema, action: actionSchema, oracle: oracleSchema, kind: candidateKindSchema, summary: z.string().min(1), evidence: z.array(evidenceRefSchema).min(1).readonly() }).strict();
// prettier-ignore
export const dispositionSchema = z.discriminatedUnion("status", [z.object({ status: z.literal("dismissed"), candidateId: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, verifierRefs: z.array(z.string().min(1)).min(1).readonly(), evidence: z.array(evidenceRefSchema).min(1).readonly(), rationale: z.string().min(1) }).strict(), z.object({ status: z.literal("fixed"), candidateId: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, verifierRefs: z.array(z.string().min(1)).min(1).readonly(), evidence: z.array(evidenceRefSchema).min(1).readonly(), findingRef: z.string().min(1), fixSha: sourceShaSchema, rationale: z.string().min(1) }).strict()]);
export type * from "./contracts-types.ts";
