import type { z } from "zod";

import type {
  actionOperationSchema,
  actionSafetySchema,
  actionSchema,
  actionTargetSchema,
  campaignManifestSchema,
  candidateSchema,
  controlTransitionSchema,
  coverageCellSchema,
  coverageVerdictSchema,
  dispositionSchema,
  domControlSchema,
  evidenceBundleSchema,
  evidenceDimensionSchema,
  evidenceKindSchema,
  evidenceRefSchema,
  exclusionSchema,
  faultIdSchema,
  faultModeSchema,
  lifecycleStateSchema,
  matrixAxesSchema,
  matrixConstraintSchema,
  matrixDeclarationSchema,
  matrixExecutionKindSchema,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  matrixObservationSchema,
  networkEvidencePolicySchema,
  oracleDimensionSchema,
  oracleSchema,
  ownershipDensitySchema,
  permissionBoundarySchema,
  resolverKeySchema,
  resolverOutcomeIdentitySchema,
  resolverOutcomeInapplicableSchema,
  resolverOutcomeKindSchema,
  roleSchema,
  routeBindingSchema,
  routeBindingTargetSchema,
  routeDeclarationSchema,
  routeKindSchema,
  SEED_COUNT_DIMENSIONS,
  seedCapabilitySchema,
  seedCountBoundSchema,
  seedProfileBindingSchema,
  seedProfileDefinitionSchema,
  seedProfileSchema,
  sourceBoundResolverOutcomeSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
  stateAxesSchema,
  stateKindSchema,
  submissionStateSchema,
  toolVersionsSchema,
  viewportSchema,
} from "./contracts.ts";

export type Role = z.infer<typeof roleSchema>;
export type SeedProfile = z.infer<typeof seedProfileSchema>;
export type SeedCapability = z.infer<typeof seedCapabilitySchema>;
export type SeedCountDimension = (typeof SEED_COUNT_DIMENSIONS)[number];
export type SeedCountBound = z.infer<typeof seedCountBoundSchema>;
export type SeedProfileDefinition = z.infer<typeof seedProfileDefinitionSchema>;
export type SeedProfileBinding = z.infer<typeof seedProfileBindingSchema>;
export type SourceTree = z.infer<typeof sourceTreeSchema>;
export type LifecycleState = z.infer<typeof lifecycleStateSchema>;
export type SubmissionState = z.infer<typeof submissionStateSchema>;
export type OwnershipDensity = z.infer<typeof ownershipDensitySchema>;
export type PermissionBoundary = z.infer<typeof permissionBoundarySchema>;
export type FaultMode = z.infer<typeof faultModeSchema>;
export type MatrixExecutionKind = z.infer<typeof matrixExecutionKindSchema>;
export type StableIdentifier = z.infer<typeof stableIdentifierSchema>;
export type FaultId = z.infer<typeof faultIdSchema>;
export type ControlTransition = z.infer<typeof controlTransitionSchema>;
export type ActionOperation = z.infer<typeof actionOperationSchema>;
export type ActionSafety = z.infer<typeof actionSafetySchema>;
export type StateKind = z.infer<typeof stateKindSchema>;
export type EvidenceDimension = z.infer<typeof evidenceDimensionSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type CoverageVerdict = z.infer<typeof coverageVerdictSchema>;
export type ToolVersions = z.infer<typeof toolVersionsSchema>;
export type ManifestMatrixConstraint = z.infer<typeof matrixConstraintSchema>;
export type MatrixDeclaration = z.infer<typeof matrixDeclarationSchema>;
export type Viewport = z.infer<typeof viewportSchema>;
export type StateAxes = z.infer<typeof stateAxesSchema>;
export type MatrixAxes = z.infer<typeof matrixAxesSchema>;
export type Action = z.infer<typeof actionSchema>;
export type ActionTarget = z.infer<typeof actionTargetSchema>;
export type MatrixObservation = z.infer<typeof matrixObservationSchema>;
export type MatrixExecution = z.infer<typeof matrixExecutionSchema>;
export type MatrixExecutionInapplicable = z.infer<
  typeof matrixInapplicableSchema
>;
export type NetworkEvidencePolicy = z.infer<typeof networkEvidencePolicySchema>;
export type OracleDimension = z.infer<typeof oracleDimensionSchema>;
export type Oracle = z.infer<typeof oracleSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;
export type DOMControl = z.infer<typeof domControlSchema>;
export type RouteBindingTarget = z.infer<typeof routeBindingTargetSchema>;
export type RouteKind = z.infer<typeof routeKindSchema>;
export type ResolverKey = z.infer<typeof resolverKeySchema>;
export type ResolverOutcomeKind = z.infer<typeof resolverOutcomeKindSchema>;
export type ResolverOutcomeIdentity = z.infer<
  typeof resolverOutcomeIdentitySchema
>;
export type SourceBoundResolverOutcome = z.infer<
  typeof sourceBoundResolverOutcomeSchema
>;
export type ResolverOutcomeInapplicable = z.infer<
  typeof resolverOutcomeInapplicableSchema
>;

export type RouteBinding = z.infer<typeof routeBindingSchema>;
export interface RouteDeclarationInput {
  readonly role: Role;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly landingRoute?: string | undefined;
  readonly networkPolicy: NetworkEvidencePolicy | null;
  readonly allowsCurrentLive?: boolean | undefined;
  readonly kind?: RouteKind | undefined;
  readonly resolverKey?: ResolverKey | undefined;
  readonly resolverOutcomes?: readonly ResolverOutcomeKind[] | undefined;
}
export type RouteDeclaration = z.infer<typeof routeDeclarationSchema>;
export type Exclusion = z.infer<typeof exclusionSchema>;
export type CampaignManifest = z.infer<typeof campaignManifestSchema>;
export type CoverageCell = z.infer<typeof coverageCellSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Disposition = z.infer<typeof dispositionSchema>;
