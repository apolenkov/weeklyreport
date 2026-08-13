import * as path from "node:path";

import { nextDistDirForNextConfig } from "../runtime/runtime-next-dist.ts";
import type { PreflightShardLaunchPreparation } from "./preflight-shard-launcher-support.ts";

const LEGACY_ARTIFACT_KEYS = [
  "RUNTIME_SWEEP_PREFLIGHT",
  "RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT",
  "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
  "RUNTIME_SWEEP_PREFLIGHT_SEGMENTS",
  "RUNTIME_SWEEP_PREFLIGHT_CANARY",
] as const;

const SHARD_ARTIFACT_KEYS = [
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_JOURNAL",
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_COMPLETION",
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF",
  "RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT",
] as const;

const SHARD_CHILD_PATH_KEYS = [
  ...LEGACY_ARTIFACT_KEYS,
  ...SHARD_ARTIFACT_KEYS,
  "DATABASE_URL",
  "E2E_API_PORT",
  "E2E_BULLMQ_PREFIX",
  "E2E_DATABASE_URL",
  "E2E_WEB_PORT",
  "FRONTEND_URL",
  "APP_BASE_URL",
  "PDF_BASE_URL",
  "PDF_OUTPUT_DIR",
  "LOG_DIR",
  "NEXT_DIST_DIR",
  "OUTPUT_DIR",
  "PORT",
  "REDIS_HOST",
  "REDIS_PORT",
  "RUNTIME_SWEEP_BASE_URL",
  "NEXT_PUBLIC_API_URL",
] as const;

const WEB_ROOT = path.resolve(import.meta.dirname, "../../../../apps/web");

/** Build the only environment accepted by the real-browser shard config. */
export const preflightShardChildEnvironment = (
  inherited: NodeJS.ProcessEnv,
  launch: PreflightShardLaunchPreparation,
): NodeJS.ProcessEnv => {
  const filtered = Object.fromEntries(
    Object.entries(inherited).filter(
      ([key]) =>
        !SHARD_CHILD_PATH_KEYS.includes(
          key as (typeof SHARD_CHILD_PATH_KEYS)[number],
        ),
    ),
  );
  const proof = launch.resourceProof;
  return {
    ...filtered,
    RUNTIME_SWEEP_PREFLIGHT_MODE: "shard",
    RUNTIME_SWEEP_ARCHIVE: launch.archiveRoot,
    RUNTIME_SWEEP_SOURCE: launch.sourcePath,
    RUNTIME_SWEEP_SOURCE_SHA: launch.source.sourceSha,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_ID: launch.shard.logicalShardId,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_DONOR_ID: proof.donorId,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_DONOR_ROOT: proof.donorRoot,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_ATTEMPT_ID: proof.shardAttemptId,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT: launch.assignmentPath,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF: launch.resourceProofPath,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_JOURNAL: launch.journalPath,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_COMPLETION: launch.completionPath,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_LOG_DIR: proof.resources.logDir,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_PDF_DIR: proof.resources.pdfDir,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_OUTPUT_DIR: proof.resources.outputDir,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_NEXT_DIST_DIR: proof.resources.nextDistDir,
    E2E_API_PORT: String(proof.resources.api.port),
    E2E_WEB_PORT: String(proof.resources.web.port),
    E2E_DATABASE_URL: launch.databaseUrl,
    DATABASE_URL: launch.databaseUrl,
    PORT: String(proof.resources.api.port),
    FRONTEND_URL: launch.webOrigin,
    APP_BASE_URL: launch.webOrigin,
    PDF_BASE_URL: launch.webOrigin,
    PDF_OUTPUT_DIR: proof.resources.pdfDir,
    LOG_DIR: proof.resources.logDir,
    NEXT_DIST_DIR: nextDistDirForNextConfig(
      WEB_ROOT,
      proof.resources.nextDistDir,
    ),
    OUTPUT_DIR: proof.resources.outputDir,
    REDIS_HOST: proof.resources.redis.host,
    REDIS_PORT: String(proof.resources.redis.port),
    E2E_BULLMQ_PREFIX: proof.resources.queuePrefix,
    RUNTIME_SWEEP_BASE_URL: launch.webOrigin,
    NEXT_PUBLIC_API_URL: launch.apiUrl,
  };
};
