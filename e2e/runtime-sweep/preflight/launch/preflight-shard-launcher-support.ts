import { e2eDatabaseIdentity } from "../../../helpers/e2e-database-target.ts";
import type { ManifestCommandRunner } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { assertLivePreflightSourceIdentity } from "../canary/preflight-canary.ts";
import type { PreflightCanaryLiveIdentity } from "../canary/preflight-canary-contract.ts";
import { ensurePreflightArchiveRoot } from "../preflight-archive-path.ts";
import type { PreflightShardJournalContext } from "../shards/journal/preflight-shard-journal-context.ts";
import type { PreflightShardResourceProof } from "../shards/resources/preflight-shard-resource-proof-contract.ts";
import { assertPreflightShardResourceProofFilesystem } from "../shards/resources/preflight-shard-resource-proof-validation.ts";
import {
  normalizedPath,
  readShardProofContext,
  readShardSourceInputs,
  requiredEnv,
} from "./preflight-shard-launcher-input.ts";

const MIN_TCP_PORT = 1024;
const MAX_TCP_PORT = 65_535;

const SHARD_SELECTOR_KEYS = [
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_ID",
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_LOGICAL_ID",
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_INDEX",
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_SELECTOR",
] as const;
const LEGACY_SELECTOR_KEYS = [
  "RUNTIME_SWEEP_PREFLIGHT_REQUIRED_STATE_ID",
  "RUNTIME_SWEEP_CANARY_SELECTOR",
  "RUNTIME_SWEEP_CANARY_STATE_ID",
  "RUNTIME_SWEEP_CANARY_ROLE",
  "RUNTIME_SWEEP_CANARY_ROUTE",
  "RUNTIME_SWEEP_CANARY_PROFILE",
] as const;
const LEGACY_ARTIFACT_KEYS = [
  "RUNTIME_SWEEP_PREFLIGHT",
  "RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT",
  "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
  "RUNTIME_SWEEP_PREFLIGHT_SEGMENTS",
  "RUNTIME_SWEEP_PREFLIGHT_CANARY",
] as const;
const configured = (environment: NodeJS.ProcessEnv, key: string): boolean => {
  const value = environment[key];
  return value !== undefined && value.trim() !== "";
};

const assertNoMixedSelectors = (environment: NodeJS.ProcessEnv): void => {
  const mode = environment.RUNTIME_SWEEP_PREFLIGHT_MODE?.trim();
  if (mode !== undefined && mode !== "" && mode !== "shard")
    throw new Error(
      `Runtime preflight shard cannot use RUNTIME_SWEEP_PREFLIGHT_MODE=${mode}`,
    );
  const selectors = SHARD_SELECTOR_KEYS.filter((key) =>
    configured(environment, key),
  );
  if (selectors.length !== 1 || selectors[0] !== SHARD_SELECTOR_KEYS[0])
    throw new Error(
      "Runtime preflight shard requires exactly one logical shard selector; only RUNTIME_SWEEP_PREFLIGHT_SHARD_ID is supported",
    );
  const conflicts = [...LEGACY_SELECTOR_KEYS, ...LEGACY_ARTIFACT_KEYS].filter(
    (key) => configured(environment, key),
  );
  if (conflicts.length > 0)
    throw new Error(
      `Runtime preflight shard selectors cannot be mixed with legacy preflight mechanisms: ${conflicts.join(", ")}`,
    );
};

const portFromEnvironment = (
  environment: NodeJS.ProcessEnv,
  name: string,
): number => {
  const port = Number(requiredEnv(environment, name));
  if (!Number.isInteger(port) || port < MIN_TCP_PORT || port > MAX_TCP_PORT)
    throw new Error(`Runtime preflight shard requires a valid ${name}`);
  return port;
};

const assertConfiguredResources = (
  environment: NodeJS.ProcessEnv,
  proof: PreflightShardResourceProof,
  archiveRoot: string,
): Readonly<{ apiPort: number; webPort: number; databaseUrl: string }> => {
  if (proof.resources.archiveRoot !== archiveRoot)
    throw new Error(
      "Persisted shard resource proof archive root is not canonical",
    );
  const apiPort = portFromEnvironment(environment, "E2E_API_PORT");
  const webPort = portFromEnvironment(environment, "E2E_WEB_PORT");
  const redisPort = portFromEnvironment(environment, "REDIS_PORT");
  if (
    apiPort !== proof.resources.api.port ||
    webPort !== proof.resources.web.port
  )
    throw new Error(
      "API/web ports do not match the persisted shard resource proof",
    );
  if (
    environment.REDIS_HOST?.trim() !== proof.resources.redis.host ||
    redisPort !== proof.resources.redis.port
  )
    throw new Error(
      "Redis environment does not match the persisted shard resource proof",
    );
  const queuePrefix = requiredEnv(environment, "E2E_BULLMQ_PREFIX");
  if (queuePrefix !== proof.resources.queuePrefix)
    throw new Error(
      "E2E_BULLMQ_PREFIX does not match the persisted shard resource proof",
    );
  const databaseUrl = requiredEnv(environment, "E2E_DATABASE_URL");
  const identity = e2eDatabaseIdentity(databaseUrl);
  const expected = proof.resources.database.identity;
  if (
    identity.host !== expected.host ||
    identity.port !== String(expected.port) ||
    identity.database !== expected.database
  )
    throw new Error(
      "E2E_DATABASE_URL does not match the persisted shard resource proof",
    );
  return { apiPort, webPort, databaseUrl };
};

export type PreflightShardLaunchPreparation = Readonly<{
  readonly sourcePath: string;
  readonly assignmentPath: string;
  readonly resourceProofPath: string;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly completionPath: string;
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardLaunchPreparation["context"]["assignment"];
  readonly shard: PreflightShardLaunchPreparation["context"]["shard"];
  readonly resourceProof: PreflightShardResourceProof;
  readonly context: PreflightShardJournalContext;
  readonly databaseUrl: string;
  readonly apiUrl: string;
  readonly webOrigin: string;
  readonly liveIdentity: PreflightCanaryLiveIdentity;
}>;

export async function preparePreflightShardLaunch(input: {
  readonly environment: NodeJS.ProcessEnv;
  readonly repoRoot: string;
  readonly validatedSource: SourceArtifact;
  readonly runCommand?: ManifestCommandRunner;
}): Promise<PreflightShardLaunchPreparation> {
  assertNoMixedSelectors(input.environment);
  const archiveRoot = await ensurePreflightArchiveRoot(
    normalizedPath(input.environment, "RUNTIME_SWEEP_ARCHIVE"),
  );
  const sourceInputs = await readShardSourceInputs({
    environment: input.environment,
    archiveRoot,
    validatedSource: input.validatedSource,
  });
  const proofContext = await readShardProofContext({
    environment: input.environment,
    archiveRoot,
    source: sourceInputs.source,
    assignment: sourceInputs.assignment,
  });
  const resources = assertConfiguredResources(
    input.environment,
    proofContext.resourceProof,
    archiveRoot,
  );
  await assertPreflightShardResourceProofFilesystem(proofContext.resourceProof);
  const liveIdentity = await assertLivePreflightSourceIdentity({
    source: sourceInputs.source,
    repoRoot: input.repoRoot,
    ...(input.environment.RUNTIME_SWEEP_SOURCE_SHA === undefined
      ? {}
      : { expectedSourceSha: input.environment.RUNTIME_SWEEP_SOURCE_SHA }),
    ...(input.runCommand === undefined ? {} : { runCommand: input.runCommand }),
  });
  return {
    sourcePath: sourceInputs.sourcePath,
    assignmentPath: sourceInputs.assignmentPath,
    resourceProofPath: proofContext.resourceProofPath,
    archiveRoot,
    journalPath: proofContext.journalPath,
    completionPath: proofContext.completionPath,
    source: sourceInputs.source,
    assignment: sourceInputs.assignment,
    shard: proofContext.shard,
    resourceProof: proofContext.resourceProof,
    context: proofContext.context,
    databaseUrl: resources.databaseUrl,
    apiUrl: `http://127.0.0.1:${resources.apiPort}`,
    webOrigin: `http://127.0.0.1:${resources.webPort}`,
    liveIdentity,
  };
}

export { preflightShardChildEnvironment } from "./preflight-shard-child-environment.ts";
