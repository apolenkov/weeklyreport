import path from "node:path";

import { compileCampaignMatrix } from "../matrix/campaign-matrix.ts";
import {
  finalizeCampaignMatrix,
  type FrozenMatrix,
  serializeFrozenMatrix,
} from "../matrix/matrix-finalizer.ts";
import { SPECIALIZED_DECLARATIONS } from "../matrix/specialized/specialized-declarations.ts";
import {
  assertPreflightMatchesSource,
  type PreflightArtifact,
  readPreflightArtifact,
} from "../preflight/artifacts/preflight-artifact.ts";
import { inflatePreflightRevealData } from "../preflight/artifacts/preflight-artifact-reveal.ts";
import {
  type CampaignManifest,
  campaignManifestSchema,
  matrixDeclarationSchema,
  SEED_PROFILES,
  type SourceTree,
  STATE_KINDS,
} from "../source/contracts.ts";
import {
  type CampaignManifestInput,
  cleanSourceIdentity,
  digestFiles,
  freezeDeep,
  type ManifestCommandRunner,
  ManifestInputError,
  requirePath,
  runGitCommand,
  writeAtomicManifestPair,
  writeManifestFile,
} from "../source/manifest-source.ts";
import { assertValidatedRuntimeSource } from "../source/runtime-source-validation.ts";
import {
  parseSourceArtifact,
  serializeSourceArtifact,
  type SourceArtifact,
} from "../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import {
  completeSet,
  normalizeRoutesAndProfiles,
  sortExclusions,
  sortRoles,
} from "./manifest-normalization.ts";

export type {
  CampaignManifestInput,
  ManifestCommandRunner,
  SeedProfileDefinitionInput,
} from "../source/manifest-source.ts";
export {
  DirtyWorktreeError,
  ManifestGitError,
  ManifestInputError,
  ManifestWriteError,
  SourceShaMismatchError,
} from "../source/manifest-source.ts";
export {
  parseSourceArtifact,
  serializeSourceArtifact,
  type SourceArtifact,
  sourceArtifactSchema,
} from "../source/source-artifact.ts";

const sourceBody = (input: {
  readonly manifest: CampaignManifestInput;
  readonly sourceTree: SourceTree;
  readonly treeDigest: string;
  readonly catalogDigest: string;
  readonly domainSpecDigest: string;
  readonly routes: CampaignManifest["routes"];
  readonly seedProfiles: CampaignManifest["seedProfiles"];
  readonly matrixDeclaration: CampaignManifest["matrixDeclaration"];
  readonly plan: ReturnType<typeof compileCampaignMatrix>;
}) => ({
  artifact: "SOURCE" as const,
  version: 2 as const,
  campaignId: input.manifest.campaignId,
  sourceSha: input.manifest.sourceSha,
  sourceTree: input.sourceTree,
  treeDigest: input.treeDigest,
  browser: input.manifest.browser,
  viewport: input.manifest.viewport,
  roles: sortRoles(input.manifest.roles),
  routes: input.routes,
  profiles: completeSet(
    input.manifest.profiles,
    SEED_PROFILES,
    "seed profiles",
  ),
  seedProfiles: input.seedProfiles,
  stateKinds: completeSet(
    input.manifest.stateKinds,
    STATE_KINDS,
    "state kinds",
  ),
  actions: input.manifest.actions,
  toolVersions: input.manifest.toolVersions,
  catalogDigest: input.catalogDigest,
  domainSpecDigest: input.domainSpecDigest,
  matrixDeclaration: input.matrixDeclaration,
  exclusions: sortExclusions(input.manifest.exclusions),
  plan: input.plan,
  specializedDeclarations: SPECIALIZED_DECLARATIONS,
  matrixLimits: input.manifest.matrixLimits,
});

export async function buildCampaignSource(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<SourceArtifact> {
  const repoRoot = requirePath(input.repoRoot, "repoRoot");
  requirePath(input.outputPath, "outputPath");
  if (input.campaignId.trim() === "")
    throw new ManifestInputError("campaignId is required");
  const { sourceTree, treeDigest } = await cleanSourceIdentity(
    { ...input, repoRoot },
    runCommand,
  );
  const [catalogDigest, domainSpecDigest] = await Promise.all([
    digestFiles(repoRoot, input.catalogPaths, "Catalog"),
    digestFiles(repoRoot, input.domainSpecPaths, "Durable spec"),
  ]);
  const matrixDeclaration = matrixDeclarationSchema.parse(
    input.matrixDeclaration,
  );
  const { routes, seedProfiles } = normalizeRoutesAndProfiles(input);
  const plan = compileCampaignMatrix({
    sourceSha: input.sourceSha,
    declaration: matrixDeclaration,
    routes,
    seedProfiles,
  });
  const body = sourceBody({
    manifest: input,
    sourceTree,
    treeDigest,
    catalogDigest,
    domainSpecDigest,
    routes,
    seedProfiles,
    matrixDeclaration,
    plan,
  });
  return parseSourceArtifact({ ...body, sourceDigest: sha256Hex(body) });
}

const matrixFor = (
  source: SourceArtifact,
  preflight: PreflightArtifact,
): FrozenMatrix => {
  assertPreflightMatchesSource(source, preflight);
  return finalizeCampaignMatrix({
    sourceSha: source.sourceSha,
    sourceDigest: source.sourceDigest,
    declaration: source.matrixDeclaration,
    plan: source.plan,
    routes: source.routes,
    preflight: inflatePreflightRevealData(preflight),
    maxCases: source.matrixLimits.maxCases,
    maxControlsPerSegment: source.matrixLimits.maxControlsPerSegment,
  });
};

const manifestFor = (
  source: SourceArtifact,
  matrix: FrozenMatrix,
): CampaignManifest => {
  const {
    artifact: _artifact,
    version: _version,
    plan: _plan,
    specializedDeclarations: _specializedDeclarations,
    sourceDigest: _sourceDigest,
    matrixLimits: _matrixLimits,
    ...manifestFields
  } = source;
  return freezeDeep(
    campaignManifestSchema.parse({
      ...manifestFields,
      matrixDigest: matrix.digest,
    }),
  );
};

export async function buildCampaignManifest(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<CampaignManifest> {
  const { source, preflight } = await sourceForStageB(input, runCommand);
  const matrix = matrixFor(source, preflight);
  return manifestFor(source, matrix);
}

export function serializeCampaignManifest(manifest: CampaignManifest): string {
  return `${stableSerialize(campaignManifestSchema.parse(manifest))}\n`;
}

export async function writeCampaignSource(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<SourceArtifact> {
  const source = await buildCampaignSource(input, runCommand);
  const sourcePath = requirePath(
    input.sourcePath ??
      path.join(path.dirname(input.outputPath), "SOURCE.json"),
    "sourcePath",
  );
  await writeManifestFile(sourcePath, serializeSourceArtifact(source));
  return source;
}

const sourceForStageB = async (
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner,
): Promise<{
  readonly source: SourceArtifact;
  readonly preflight: PreflightArtifact;
}> => {
  const sourcePath = requirePath(
    input.sourcePath ??
      path.join(path.dirname(input.outputPath), "SOURCE.json"),
    "sourcePath",
  );
  const preflightPath = requirePath(
    input.preflightPath ??
      path.join(path.dirname(input.outputPath), "PREFLIGHT.json"),
    "preflightPath",
  );
  const receiptPath = requirePath(
    input.sourceValidationPath ??
      path.join(path.dirname(input.outputPath), "SOURCE-VALIDATION.json"),
    "sourceValidationPath",
  );
  const expectedSource = await buildCampaignSource(input, runCommand);
  if (input.sourceValidationFileSha256 === undefined)
    throw new ManifestInputError("sourceValidationFileSha256 is required");
  const { source } = await assertValidatedRuntimeSource({
    sourcePath,
    receiptPath,
    expectedSource,
    expectedReceiptFileSha256: input.sourceValidationFileSha256,
  });
  const preflight = await readPreflightArtifact(preflightPath);
  return { source, preflight };
};

export async function writeCampaignManifest(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<CampaignManifest> {
  const { source, preflight } = await sourceForStageB(input, runCommand);
  const matrix = matrixFor(source, preflight);
  const manifest = manifestFor(source, matrix);
  const manifestPath = requirePath(input.outputPath, "outputPath");
  await writeAtomicManifestPair({
    matrixPath: path.join(path.dirname(manifestPath), "MATRIX.json"),
    matrixText: serializeFrozenMatrix(matrix),
    manifestPath,
    manifestText: serializeCampaignManifest(manifest),
  });
  return manifest;
}
