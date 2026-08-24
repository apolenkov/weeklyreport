import { copyFile, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { writeSourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex } from "../../support/ids.ts";
import { preflightShardResourceProofPathFor } from "../shards/merge/preflight-shard-merge-assembly.ts";
import {
  createPreflightShardAssignment,
  writePreflightShardAssignment,
} from "../shards/preflight-shard-assignment.ts";
import { writePreflightShardResourceProof } from "../shards/resources/preflight-shard-resource-proof-io.ts";
import { createPreflightShardResourceProof } from "../shards/resources/preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
} from "../shards/resources/preflight-shard-resource-proof-test-support.ts";
import {
  preflightShardChildEnvironment,
  type PreflightShardLaunchPreparation,
  preparePreflightShardLaunch,
} from "./preflight-shard-launcher-support.ts";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
type ShardFixture = Readonly<{
  readonly environment: NodeJS.ProcessEnv;
  readonly source: Awaited<ReturnType<typeof buildCampaignSource>>;
  readonly launch: PreflightShardLaunchPreparation;
  readonly proofPath: string;
  readonly cleanup: () => Promise<void>;
}>;
const launchInput = (
  environment: NodeJS.ProcessEnv,
  source: ShardFixture["source"],
) => ({
  environment,
  repoRoot: REPO_ROOT,
  validatedSource: source,
  runCommand: fakeManifestGit(),
});
const resourceDirectories = (resources: ReturnType<typeof resourcesFor>) => [
  resources.nextDistDir,
  resources.logDir,
  resources.pdfDir,
  resources.outputDir,
  resources.archiveRoot,
];
const createShardFixture = async (): Promise<ShardFixture> => {
  const manifestFixture = await createManifestFixture();
  const fixtureRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "preflight-shard-launch-")),
  );
  const donorRoot = path.join(fixtureRoot, "donor-pro");
  await mkdir(donorRoot, { recursive: true });
  const source = await buildCampaignSource(
    manifestFixture.input,
    fakeManifestGit(),
  );
  const assignment = createPreflightShardAssignment(source, 1);
  const shard = assignment.shards[0];
  if (shard === undefined) throw new Error("fixture has no shard");
  const resources = resourcesFor(path.join(donorRoot, "resources"), 0);
  await Promise.all(
    resourceDirectories(resources).map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  const proof = createPreflightShardResourceProof({
    source,
    assignment,
    shard,
    donorId: "Pro",
    donorRoot,
    shardAttemptId: "attempt-1",
    browser: defaultBrowser,
    runtime: defaultRuntime,
    resources,
  });
  const archiveRoot = proof.resources.archiveRoot;
  const sourcePath = path.join(archiveRoot, "SOURCE.json");
  const assignmentPath = path.join(
    archiveRoot,
    "PREFLIGHT_SHARD_ASSIGNMENT.json",
  );
  await writeSourceArtifact(sourcePath, source);
  await writePreflightShardAssignment({
    archiveRoot,
    filePath: assignmentPath,
    assignment,
  });
  const context = { source, assignment, shard, resourceProof: proof } as const;
  const proofPath = preflightShardResourceProofPathFor(context);
  await writePreflightShardResourceProof({
    archiveRoot,
    filePath: proofPath,
    proof,
  });
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
    RUNTIME_SWEEP_ARCHIVE: archiveRoot,
    RUNTIME_SWEEP_SOURCE: sourcePath,
    RUNTIME_SWEEP_SOURCE_SHA: source.sourceSha,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_ID: shard.logicalShardId,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT: assignmentPath,
    RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF: proofPath,
    E2E_DATABASE_URL:
      "postgresql://runtime:secret@127.0.0.1:5432/customreport_e2e_lane_a_test",
    E2E_API_PORT: String(proof.resources.api.port),
    E2E_WEB_PORT: String(proof.resources.web.port),
    REDIS_HOST: proof.resources.redis.host,
    REDIS_PORT: String(proof.resources.redis.port),
    E2E_BULLMQ_PREFIX: proof.resources.queuePrefix,
  };
  const launch = await preparePreflightShardLaunch(
    launchInput(environment, source),
  );
  return {
    environment,
    source,
    launch,
    proofPath,
    cleanup: async () => {
      await rm(donorRoot, { recursive: true, force: true });
      await rm(manifestFixture.root, { recursive: true, force: true });
    },
  };
};
const withShardFixture = async (
  callback: (fixture: ShardFixture) => Promise<void> | void,
): Promise<void> => {
  const fixture = await createShardFixture();
  try {
    await callback(fixture);
  } finally {
    await fixture.cleanup();
  }
};
describe("source-bound shard prelaunch", () => {
  it("passes the exact canonical child environment without legacy paths", async () => {
    await withShardFixture(({ environment, launch }) => {
      const child = preflightShardChildEnvironment(
        {
          ...environment,
          RUNTIME_SWEEP_PREFLIGHT: "/forged/PREFLIGHT.json",
          RUNTIME_SWEEP_PREFLIGHT_JOURNAL: "/forged/PREFLIGHT.journal.jsonl",
          LOG_DIR: "/forged/logs",
          NEXT_DIST_DIR: "/forged/next",
          E2E_DATABASE_URL: "postgresql://forged.invalid/forged",
        },
        launch,
      );
      expect(child).toMatchObject({
        RUNTIME_SWEEP_PREFLIGHT_MODE: "shard",
        RUNTIME_SWEEP_SOURCE: launch.sourcePath,
        RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT: launch.assignmentPath,
        RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF: launch.resourceProofPath,
        RUNTIME_SWEEP_PREFLIGHT_SHARD_JOURNAL: launch.journalPath,
        RUNTIME_SWEEP_PREFLIGHT_SHARD_COMPLETION: launch.completionPath,
        E2E_API_PORT: String(launch.resourceProof.resources.api.port),
        E2E_WEB_PORT: String(launch.resourceProof.resources.web.port),
        REDIS_PORT: String(launch.resourceProof.resources.redis.port),
        E2E_BULLMQ_PREFIX: launch.resourceProof.resources.queuePrefix,
        LOG_DIR: launch.resourceProof.resources.logDir,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
      });
      expect(path.isAbsolute(child.NEXT_DIST_DIR ?? "")).toBe(false);
      expect(child.RUNTIME_SWEEP_PREFLIGHT).toBeUndefined();
      expect(child.RUNTIME_SWEEP_PREFLIGHT_JOURNAL).toBeUndefined();
    });
  });
  it("rejects an unknown logical shard before a child can be spawned", async () => {
    await withShardFixture(async ({ environment, source }) => {
      await expect(
        preparePreflightShardLaunch(
          launchInput(
            {
              ...environment,
              RUNTIME_SWEEP_PREFLIGHT_SHARD_ID: "unknown-shard",
            },
            source,
          ),
        ),
      ).rejects.toThrow("Unknown logical shard id");
    });
  });
  it("rejects a stale source selector before a child can be spawned", async () => {
    await withShardFixture(async ({ environment, source }) => {
      await expect(
        preparePreflightShardLaunch(
          launchInput(
            {
              ...environment,
              RUNTIME_SWEEP_SOURCE_SHA: "f".repeat(40),
            },
            source,
          ),
        ),
      ).rejects.toThrow("source SHA is stale");
    });
  });
  it("rejects a forged proof path before a child can be spawned", async () => {
    await withShardFixture(async ({ environment, proofPath, source }) => {
      const forgedPath = path.join(
        path.dirname(proofPath),
        "forged-proof.json",
      );
      await copyFile(proofPath, forgedPath);
      await expect(
        preparePreflightShardLaunch(
          launchInput(
            {
              ...environment,
              RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF: forgedPath,
            },
            source,
          ),
        ),
      ).rejects.toThrow("canonical shard path");
    });
  });
  it.each([
    ["donor", "RUNTIME_SWEEP_PREFLIGHT_SHARD_DONOR_ID", "Air"],
    ["attempt", "RUNTIME_SWEEP_PREFLIGHT_SHARD_ATTEMPT_ID", "attempt-2"],
  ] as const)(
    "rejects a wrong %s identity before a child can be spawned",
    async (_label, key, value) => {
      await withShardFixture(async ({ environment, source }) => {
        await expect(
          preparePreflightShardLaunch(
            launchInput({ ...environment, [key]: value }, source),
          ),
        ).rejects.toThrow(/selector does not match/u);
      });
    },
  );
  it("rejects mixed shard and canary selectors before reading or spawning", async () => {
    await withShardFixture(async ({ environment, source }) => {
      await expect(
        preparePreflightShardLaunch(
          launchInput(
            {
              ...environment,
              RUNTIME_SWEEP_CANARY_STATE_ID: "state-from-canary",
            },
            source,
          ),
        ),
      ).rejects.toThrow("cannot be mixed");
    });
  });
  it("rejects a contradictory preflight mode before reading or spawning", async () => {
    await withShardFixture(async ({ environment, source }) => {
      await expect(
        preparePreflightShardLaunch(
          launchInput(
            {
              ...environment,
              RUNTIME_SWEEP_PREFLIGHT_MODE: "full",
            },
            source,
          ),
        ),
      ).rejects.toThrow("cannot use RUNTIME_SWEEP_PREFLIGHT_MODE=full");
    });
  });
  it("rejects a forged proof payload through donor binding", async () => {
    await withShardFixture(async ({ environment, launch, source }) => {
      const { proofDigest: _proofDigest, ...proofBody } = launch.resourceProof;
      const forgedBody = { ...proofBody, donorId: "Air" };
      const forged = {
        ...forgedBody,
        proofDigest: sha256Hex(forgedBody),
      };
      await rm(launch.resourceProofPath);
      await writePreflightShardResourceProof({
        archiveRoot: launch.archiveRoot,
        filePath: launch.resourceProofPath,
        proof: forged,
      });
      await expect(
        preparePreflightShardLaunch(
          launchInput(
            {
              ...environment,
              RUNTIME_SWEEP_PREFLIGHT_SHARD_DONOR_ID: "Pro",
            },
            source,
          ),
        ),
      ).rejects.toThrow("donor selector does not match");
    });
  });
});
