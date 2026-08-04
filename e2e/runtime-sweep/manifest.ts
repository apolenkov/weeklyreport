import {
  type CampaignManifest,
  campaignManifestSchema,
  CANONICAL_ROLES,
  type Exclusion,
  matrixDeclarationSchema,
  type Role,
  type RouteDeclaration,
  SEED_PROFILES,
  seedProfileDefinitionSchema,
  STATE_KINDS,
} from "./contracts.ts";
import { sha256Hex, stableSerialize } from "./ids.ts";
import {
  type CampaignManifestInput,
  cleanTreeDigest,
  digestFiles,
  freezeDeep,
  type ManifestCommandRunner,
  ManifestInputError,
  requirePath,
  runGitCommand,
  type SeedProfileDefinitionInput,
  writeManifestFile,
} from "./manifest-source.ts";

export type {
  CampaignManifestInput,
  ManifestCommandRunner,
  SeedProfileDefinitionInput,
} from "./manifest-source.ts";
export {
  DirtyWorktreeError,
  ManifestGitError,
  ManifestInputError,
  ManifestWriteError,
  SourceShaMismatchError,
} from "./manifest-source.ts";

const REQUIRED_EXCLUSION_TARGETS = [
  "firefox",
  "webkit",
  "mobile",
  "tablet",
] as const;

function sortRoles(roles: readonly Role[]): readonly Role[] {
  const unique = new Set(roles);
  if (unique.size !== CANONICAL_ROLES.length)
    throw new ManifestInputError(
      "Manifest must declare all canonical roles once",
    );
  if (CANONICAL_ROLES.some((role) => !unique.has(role)))
    throw new ManifestInputError("Manifest must declare all canonical roles");
  return [...CANONICAL_ROLES];
}

function completeSet<T extends string>(
  values: readonly T[],
  expected: readonly T[],
  label: string,
): readonly T[] {
  const unique = new Set(values);
  if (
    unique.size !== expected.length ||
    expected.some((value) => !unique.has(value))
  ) {
    throw new ManifestInputError(`Manifest must declare all ${label}`);
  }
  return [...expected];
}

function sortRoutes(
  routes: readonly RouteDeclaration[],
): readonly RouteDeclaration[] {
  const keys = routes.map(
    ({ role, catalogRoute, resolvedRoute }) =>
      `${role}\0${catalogRoute}\0${resolvedRoute}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new ManifestInputError("Manifest routes must be unique");
  const routeRoles = new Set(routes.map(({ role }) => role));
  if (routeRoles.size !== CANONICAL_ROLES.length)
    throw new ManifestInputError(
      "Manifest routes must cover all canonical roles",
    );
  return routes.toSorted(
    (left, right) =>
      left.role.localeCompare(right.role) ||
      left.catalogRoute.localeCompare(right.catalogRoute) ||
      left.resolvedRoute.localeCompare(right.resolvedRoute),
  );
}

function sortExclusions(
  exclusions: readonly Exclusion[],
): readonly Exclusion[] {
  const targets = new Set(exclusions.map(({ target }) => target.toLowerCase()));
  const missing = REQUIRED_EXCLUSION_TARGETS.filter(
    (target) => !targets.has(target),
  );
  if (missing.length > 0)
    throw new ManifestInputError(
      `Manifest exclusions are missing: ${missing.join(", ")}`,
    );
  return exclusions.toSorted(
    (left, right) =>
      left.scope.localeCompare(right.scope) ||
      left.target.localeCompare(right.target) ||
      left.id.localeCompare(right.id),
  );
}

function seedBindings(
  definitions: readonly SeedProfileDefinitionInput[],
): CampaignManifest["seedProfiles"] {
  if (definitions.length !== SEED_PROFILES.length)
    throw new ManifestInputError("Manifest must declare four seed profiles");
  const parsed = definitions.map(({ profile, definition }) => ({
    profile,
    definition: seedProfileDefinitionSchema.parse(definition),
    digest: sha256Hex({ profile, definition }),
  }));
  const profiles = new Set(parsed.map(({ profile }) => profile));
  if (profiles.size !== SEED_PROFILES.length)
    throw new ManifestInputError("Manifest seed profiles must be unique");
  return parsed.toSorted((left, right) =>
    left.profile.localeCompare(right.profile),
  );
}

export async function buildCampaignManifest(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<CampaignManifest> {
  const repoRoot = requirePath(input.repoRoot, "repoRoot");
  requirePath(input.outputPath, "outputPath");
  if (input.campaignId.trim() === "")
    throw new ManifestInputError("campaignId is required");
  const treeDigest = await cleanTreeDigest({ ...input, repoRoot }, runCommand);
  const [catalogDigest, domainSpecDigest] = await Promise.all([
    digestFiles(repoRoot, input.catalogPaths, "Catalog"),
    digestFiles(repoRoot, input.domainSpecPaths, "Durable spec"),
  ]);
  const matrixDeclaration = matrixDeclarationSchema.parse(
    input.matrixDeclaration,
  );
  const seedProfiles = seedBindings(input.seedProfiles);
  const matrixDigest = sha256Hex(matrixDeclaration);
  const manifest = campaignManifestSchema.parse({
    campaignId: input.campaignId,
    sourceSha: input.sourceSha,
    treeDigest,
    browser: input.browser,
    viewport: input.viewport,
    roles: sortRoles(input.roles),
    routes: sortRoutes(input.routes),
    profiles: completeSet(input.profiles, SEED_PROFILES, "seed profiles"),
    seedProfiles,
    stateKinds: completeSet(input.stateKinds, STATE_KINDS, "state kinds"),
    actions: input.actions,
    toolVersions: input.toolVersions,
    catalogDigest,
    domainSpecDigest,
    matrixDeclaration,
    matrixDigest,
    exclusions: sortExclusions(input.exclusions),
  });
  return freezeDeep(manifest);
}

export function serializeCampaignManifest(manifest: CampaignManifest): string {
  const parsed = campaignManifestSchema.parse(manifest);
  return `${stableSerialize(parsed)}\n`;
}

export async function writeCampaignManifest(
  input: CampaignManifestInput,
  runCommand: ManifestCommandRunner = runGitCommand,
): Promise<CampaignManifest> {
  const manifest = await buildCampaignManifest(input, runCommand);
  const outputPath = requirePath(input.outputPath, "outputPath");
  await writeManifestFile(outputPath, serializeCampaignManifest(manifest));
  return manifest;
}
