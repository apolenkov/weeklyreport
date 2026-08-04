import { z } from "zod";

const tuple = <const T extends readonly [string, ...string[]]>(
  ...values: T
): Readonly<T> => Object.freeze(values);

export const CANONICAL_ROLES = tuple("lead", "head", "admin", "viewer");
export const SEED_PROFILES = tuple("minimal", "demo", "full", "stress");
// prettier-ignore
export const SEED_CAPABILITIES = tuple("admin-examples", "archive-flow", "canonical-identities", "deep-history", "editable-active-report", "foreign-content", "health-states", "multi-role-access", "ownership", "policy-examples", "project-activities", "publish-flow", "published-period", "reminders", "reopen-flow", "stress-volume", "submission-contrast");
// prettier-ignore
export const LIFECYCLE_STATES = tuple("open", "reopened", "published", "archived");
// prettier-ignore
export const SUBMISSION_STATES = tuple("draft", "submitted", "rejected", "approved");
export const OWNERSHIP_DENSITIES = tuple("none", "single", "multiple");
// prettier-ignore
export const PERMISSION_BOUNDARIES = tuple("allowed", "owner", "non-owner", "head", "admin", "viewer", "anonymous", "forbidden");
// prettier-ignore
export const FAULT_MODES = tuple("none", "auth-missing", "auth-expired", "auth-forbidden", "network-timeout", "request-aborted", "http-4xx", "http-5xx", "api-error", "concurrency-stale-version", "infrastructure-unavailable");
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
export const EVIDENCE_KINDS = tuple("dom", "url", "console", "page-error", "request", "api", "db", "axe", "keyboard", "screenshot", "geometry");
export const CANDIDATE_KINDS = tuple(
  "functional",
  "accessibility",
  "visual",
  "console",
  "network",
  "page",
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
const sourceShaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;

export const sourceShaSchema = z.string().regex(sourceShaPattern);
export const sha256DigestSchema = z.string().regex(digestPattern);
export const roleSchema = z.enum(CANONICAL_ROLES);
export const seedProfileSchema = z.enum(SEED_PROFILES);
export const seedCapabilitySchema = z.enum(SEED_CAPABILITIES);
export const lifecycleStateSchema = z.enum(LIFECYCLE_STATES);
export const submissionStateSchema = z.enum(SUBMISSION_STATES);
export const ownershipDensitySchema = z.enum(OWNERSHIP_DENSITIES);
export const permissionBoundarySchema = z.enum(PERMISSION_BOUNDARIES);
export const faultModeSchema = z.enum(FAULT_MODES);
export const controlTransitionSchema = z.enum(CONTROL_TRANSITIONS);
export const actionOperationSchema = z.enum(ACTION_OPERATIONS);
export const actionSafetySchema = z.enum(ACTION_SAFETY);
export const stateKindSchema = z.enum(STATE_KINDS);
export const evidenceDimensionSchema = z.enum(EVIDENCE_DIMENSIONS);
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
export const candidateKindSchema = z.enum(CANDIDATE_KINDS);
export const coverageVerdictSchema = z.enum(COVERAGE_VERDICTS);

// prettier-ignore
export const viewportSchema = z.object({ browser: z.literal("chromium"), width: z.literal(DESKTOP_WIDTH), height: z.literal(DESKTOP_HEIGHT) }).strict();
// prettier-ignore
export const stateAxesSchema = z.object({ profileCapability: seedCapabilitySchema, lifecycle: lifecycleStateSchema, submission: submissionStateSchema, ownershipDensity: ownershipDensitySchema, permission: permissionBoundarySchema, fault: faultModeSchema, controlTransition: controlTransitionSchema }).strict();
// prettier-ignore
export const matrixAxesSchema = z.object({ role: roleSchema, route: z.string().min(1), ...stateAxesSchema.shape }).strict();
// prettier-ignore
export const actionSchema = z.object({ intentId: z.string().min(1).optional(), controlKey: z.string().min(1), operation: actionOperationSchema, safety: actionSafetySchema, transition: controlTransitionSchema }).strict();
// prettier-ignore
export const oracleDimensionSchema = z.object({ required: z.boolean(), expectation: z.string().min(1) }).strict();
// prettier-ignore
export const oracleSchema = z.object({ domainSpecRefs: z.array(z.string().min(1)).min(1).readonly(), function: oracleDimensionSchema, accessibility: oracleDimensionSchema, visual: oracleDimensionSchema }).strict();
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
// prettier-ignore
export const routeDeclarationSchema = z.object({ role: roleSchema, catalogRoute: z.string().min(1), resolvedRoute: z.string().min(1) }).strict();
// prettier-ignore
export const exclusionSchema = z.object({ id: z.string().min(1), scope: z.enum(EXCLUSION_SCOPES), target: z.string().min(1), reason: z.string().min(1) }).strict();
// prettier-ignore
export const campaignManifestSchema = z.object({ campaignId: z.string().min(1), sourceSha: sourceShaSchema, treeDigest: sha256DigestSchema, browser: z.literal("chromium"), viewport: viewportSchema, roles: z.array(roleSchema).min(1).readonly(), routes: z.array(routeDeclarationSchema).min(1).readonly(), profiles: z.array(seedProfileSchema).min(1).readonly(), stateKinds: z.array(stateKindSchema).min(1).readonly(), actions: z.array(actionSchema).min(1).readonly(), catalogDigest: sha256DigestSchema, domainSpecDigest: sha256DigestSchema, matrixDigest: sha256DigestSchema, exclusions: z.array(exclusionSchema).readonly() }).strict();
// prettier-ignore
export const coverageCellSchema = z.object({ cellId: z.string().min(1), sourceSha: sourceShaSchema, profile: seedProfileSchema, role: roleSchema, catalogRoute: z.string().min(1), resolvedRoute: z.string().min(1), viewport: viewportSchema, state: stateAxesSchema, action: actionSchema, oracle: oracleSchema, controls: z.array(domControlSchema).readonly(), evidence: evidenceBundleSchema, verdict: coverageVerdictSchema }).strict();
// prettier-ignore
export const candidateSchema = z.object({ candidateId: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, profile: seedProfileSchema, role: roleSchema, catalogRoute: z.string().min(1), resolvedRoute: z.string().min(1), state: stateAxesSchema, action: actionSchema, oracle: oracleSchema, kind: candidateKindSchema, summary: z.string().min(1), evidence: z.array(evidenceRefSchema).min(1).readonly() }).strict();
// prettier-ignore
export const dispositionSchema = z.discriminatedUnion("status", [z.object({ status: z.literal("dismissed"), candidateId: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, verifierRefs: z.array(z.string().min(1)).min(1).readonly(), evidence: z.array(evidenceRefSchema).min(1).readonly(), rationale: z.string().min(1) }).strict(), z.object({ status: z.literal("fixed"), candidateId: z.string().min(1), cellId: z.string().min(1), sourceSha: sourceShaSchema, verifierRefs: z.array(z.string().min(1)).min(1).readonly(), evidence: z.array(evidenceRefSchema).min(1).readonly(), findingRef: z.string().min(1), fixSha: sourceShaSchema, rationale: z.string().min(1) }).strict()]);

export type Role = z.infer<typeof roleSchema>;
export type SeedProfile = z.infer<typeof seedProfileSchema>;
export type SeedCapability = z.infer<typeof seedCapabilitySchema>;
export type LifecycleState = z.infer<typeof lifecycleStateSchema>;
export type SubmissionState = z.infer<typeof submissionStateSchema>;
export type OwnershipDensity = z.infer<typeof ownershipDensitySchema>;
export type PermissionBoundary = z.infer<typeof permissionBoundarySchema>;
export type FaultMode = z.infer<typeof faultModeSchema>;
export type ControlTransition = z.infer<typeof controlTransitionSchema>;
export type ActionOperation = z.infer<typeof actionOperationSchema>;
export type ActionSafety = z.infer<typeof actionSafetySchema>;
export type StateKind = z.infer<typeof stateKindSchema>;
export type EvidenceDimension = z.infer<typeof evidenceDimensionSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type CoverageVerdict = z.infer<typeof coverageVerdictSchema>;
export type Viewport = z.infer<typeof viewportSchema>;
export type StateAxes = z.infer<typeof stateAxesSchema>;
export type MatrixAxes = z.infer<typeof matrixAxesSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Oracle = z.infer<typeof oracleSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;
export type DOMControl = z.infer<typeof domControlSchema>;
export type CampaignManifest = z.infer<typeof campaignManifestSchema>;
export type CoverageCell = z.infer<typeof coverageCellSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Disposition = z.infer<typeof dispositionSchema>;
