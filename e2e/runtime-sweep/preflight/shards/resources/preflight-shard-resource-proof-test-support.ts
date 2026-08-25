import * as path from "node:path";

import { runtimeLaneResources } from "../../../lanes/resources/runtime-lane-resources.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex } from "../../../support/ids.ts";
import {
  createPreflightShardAssignment,
  type PreflightShard,
  type PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import { withSource } from "../preflight-shard-assignment-test-support.ts";
import type {
  PreflightShardResourceProof,
  PreflightShardResourceProofResources,
} from "./preflight-shard-resource-proof-contract.ts";
import {
  createPreflightShardResourceProof,
  type CreatePreflightShardResourceProofInput,
} from "./preflight-shard-resource-proof-planner.ts";

const TEST_SHARD_COUNT = 4;
const LOOPBACK_POSTGRES_PORT = 5432;
const RESOURCE_PROOF_FIXTURE_ROOT = path.join(
  process.cwd(),
  ".runtime-shard-resource-proof-fixture",
);
const DEFAULT_DONOR_ROOT = path.join(RESOURCE_PROOF_FIXTURE_ROOT, "donor-pro");

export const defaultBrowser = {
  project: "runtime-preflight",
  name: "DesktopChrome",
  version: "142.0.7444.175",
  viewport: { browser: "chromium", width: 1440, height: 900 },
} as const;

export const defaultRuntime = {
  nodeVersion: "v26.0.0",
  pnpmVersion: "11.17.0",
  playwrightVersion: "1.62.1",
  chromiumRevision: "chromium-1234",
} as const;

export const resourcesFor = (
  root: string,
  index: number,
  database?: string,
): PreflightShardResourceProofResources => {
  const lane = runtimeLaneResources(index + 1)[index];
  if (lane === undefined) throw new Error(`fixture has no lane ${index}`);
  const databaseName = database ?? lane.databaseName;
  return {
    database: {
      name: databaseName,
      identity: {
        database: databaseName,
        host: "loopback",
        port: LOOPBACK_POSTGRES_PORT,
      },
    },
    redis: {
      host: "127.0.0.1",
      port: lane.redisPort,
      runId: `redis-run-${index + 1}`,
    },
    api: { host: "127.0.0.1", port: lane.apiPort },
    web: { host: "127.0.0.1", port: lane.webPort },
    nextDistDir: `${root}/next-${index}`,
    queuePrefix: `runtime-proof-${index + 1}`,
    logDir: `${root}/logs-${index}`,
    pdfDir: `${root}/pdf-${index}`,
    outputDir: `${root}/output-${index}`,
    archiveRoot: `${root}/archive-${index}`,
  };
};

export const withResourceProofFixture = async <T>(
  callback: (input: {
    readonly source: SourceArtifact;
    readonly assignment: PreflightShardAssignment;
    readonly proof: PreflightShardResourceProof;
    readonly shard: PreflightShard;
  }) => Promise<T> | T,
): Promise<T> => {
  return withSource((source) => {
    const assignment = createPreflightShardAssignment(source, TEST_SHARD_COUNT);
    const shard = assignment.shards[0];
    if (shard === undefined) throw new Error("fixture has no shard");
    const proof = createPreflightShardResourceProof({
      source,
      assignment,
      shard,
      donorId: "Pro",
      donorRoot: DEFAULT_DONOR_ROOT,
      shardAttemptId: "attempt-1",
      browser: defaultBrowser,
      runtime: defaultRuntime,
      resources: resourcesFor(DEFAULT_DONOR_ROOT, 0),
    });
    return callback({ source, assignment, proof, shard });
  });
};

export const withProofDigest = (
  proof: PreflightShardResourceProof,
  mutate: (
    body: Omit<PreflightShardResourceProof, "proofDigest">,
  ) => Omit<PreflightShardResourceProof, "proofDigest">,
): PreflightShardResourceProof => {
  const { proofDigest: _proofDigest, ...body } = proof;
  const mutated = mutate(body);
  return { ...mutated, proofDigest: sha256Hex(mutated) };
};

export const attemptFor = (
  source: SourceArtifact,
  assignment: PreflightShardAssignment,
  shardIndex: number,
  donorId: string,
  donorRoot: string,
  attemptId: string,
  resourceIndex: number,
): CreatePreflightShardResourceProofInput => {
  const shard = assignment.shards[shardIndex];
  if (shard === undefined)
    throw new Error(`fixture has no shard ${shardIndex}`);
  return {
    source,
    assignment,
    shard,
    donorId,
    donorRoot,
    shardAttemptId: attemptId,
    browser: defaultBrowser,
    runtime: defaultRuntime,
    resources: resourcesFor(donorRoot, resourceIndex),
  };
};
