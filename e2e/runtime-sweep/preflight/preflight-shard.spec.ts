import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary.ts";
import { runPlaywrightPreflightSegment } from "./execution/playwright-preflight.ts";
import { createPreflightRuntimePreparation } from "./runtime/preflight-runtime-setup.ts";
import { preflightShardCompletionPathFor } from "./shards/completion/preflight-shard-completion-io.ts";
import { runPreflightShard } from "./shards/execution/preflight-shard-runner.ts";
import type { PreflightShardJournalContext } from "./shards/journal/preflight-shard-journal-context.ts";
import { preflightShardJournalPathFor } from "./shards/journal/preflight-shard-journal-io.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  readPreflightShardAssignment,
} from "./shards/preflight-shard-assignment.ts";
import { readPreflightShardResourceProof } from "./shards/resources/preflight-shard-resource-proof-io.ts";
import { assertPreflightShardResourceProofMatchesSource } from "./shards/resources/preflight-shard-resource-proof-validation.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight shard requires ${name}`);
  return value;
};

const assignmentPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_ASSIGNMENT"),
);
const resourceProofPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_RESOURCE_PROOF"),
);
const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;
const logicalShardId = requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_ID");
const journalPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_JOURNAL"),
);
const completionPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_COMPLETION"),
);

test("source-bound shard publishes only SHARD_COMPLETE", async ({ page }) => {
  const source = (await assertRuntimeSourceAuthorityFromEnvironment()).source;
  const assignment = await readPreflightShardAssignment(assignmentPath);
  assertPreflightShardAssignmentMatchesSource(source, assignment);
  const shard = assignment.shards.find(
    ({ logicalShardId: candidate }) => candidate === logicalShardId,
  );
  if (shard === undefined)
    throw new Error(`Unknown logical shard id: ${logicalShardId}`);
  const resourceProof = await readPreflightShardResourceProof(
    resourceProofPath,
    archiveRoot,
  );
  assertPreflightShardResourceProofMatchesSource({
    source,
    assignment,
    proof: resourceProof,
    selectedShard: shard,
  });
  const context: PreflightShardJournalContext = {
    source,
    assignment,
    shard,
    resourceProof,
  };
  const expectedJournalPath = preflightShardJournalPathFor(context);
  const expectedCompletionPath = preflightShardCompletionPathFor(context);
  if (journalPath !== expectedJournalPath)
    throw new Error("Shard journal path is not canonical");
  if (completionPath !== expectedCompletionPath)
    throw new Error("Shard completion path is not canonical");
  if (webOrigin !== `http://127.0.0.1:${resourceProof.resources.web.port}`)
    throw new Error(
      "Shard web origin does not match the persisted resource proof",
    );

  const prepare = createPreflightRuntimePreparation({
    source,
    page,
    databaseUrl,
    repoRoot,
    apiUrl,
  });
  const result = await runPreflightShard({
    context,
    archiveRoot,
    journalPath,
    completionPath,
    assertLiveSource: () =>
      assertLivePreflightSourceIdentity({ source, repoRoot }).then(
        () => undefined,
      ),
    recreateDisposableBoundary: prepare.recreateDisposableBoundary,
    runState: ({ state, resetRequired }) =>
      runPlaywrightPreflightSegment({
        source,
        state,
        page,
        expectedOrigin: webOrigin,
        prepare,
        resetRequired,
      }),
  });
  expect(result.completion.artifact).toBe("SHARD_COMPLETE");
  expect(result.completion.logicalShardId).toBe(logicalShardId);
});
