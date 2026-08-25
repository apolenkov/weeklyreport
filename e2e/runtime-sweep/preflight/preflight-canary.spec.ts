import { access } from "node:fs/promises";
import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import {
  assertLivePreflightSourceIdentity,
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCampaignKind,
  resolvePreflightCanarySelection,
} from "./canary/preflight-canary.ts";
import { runPlaywrightPreflightRevealContinuationChunk } from "./execution/playwright-preflight-continuation.ts";
import {
  hydrateRevealContinuationAssets,
  readRevealContinuationGrant,
  writeRevealBootstrap,
  writeRevealReceiptChunk,
} from "./reveal/continuation/preflight-reveal-continuation-io.ts";
import { revealContinuationLimitsFromEnvironment } from "./reveal/continuation/preflight-reveal-continuation-limits.ts";
import { assertRevealExecutionGrantInput } from "./reveal/continuation/preflight-reveal-continuation-runner.ts";
import { createPreflightRuntimePreparation } from "./runtime/preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight canary requires ${name}`);
  return value;
};

const canaryPath = path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT_CANARY"));
const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;

const expectedSourceSha = process.env.RUNTIME_SWEEP_CANARY_SOURCE_SHA?.trim();
const continuationInputPath =
  process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_INPUT?.trim();
const continuationOutputPath =
  process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_OUTPUT?.trim();
const continuationAttemptId =
  process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ID?.trim();
const continuationExpectedGrantDigest =
  process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_EXPECTED_GRANT_DIGEST?.trim();
const continuationDeadlineAt =
  process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_DEADLINE_AT?.trim();
const continuationLimits = revealContinuationLimitsFromEnvironment(process.env);

test("exact-state preflight canary reuses the full segment runner", async ({
  page,
}) => {
  const source = (await assertRuntimeSourceAuthorityFromEnvironment()).source;
  const campaignKind = resolvePreflightCampaignKind({
    ...(process.env.RUNTIME_SWEEP_CAMPAIGN_KIND === undefined
      ? {}
      : { kind: process.env.RUNTIME_SWEEP_CAMPAIGN_KIND }),
    canaryPath,
    ...(process.env.RUNTIME_SWEEP_CANARY_STATE_ID === undefined
      ? {}
      : { stateId: process.env.RUNTIME_SWEEP_CANARY_STATE_ID }),
  });
  if (campaignKind === "initial")
    throw new Error("Initial campaigns cannot run a repair canary");
  const selector = preflightCanarySelectorFromEnvironment(process.env);

  await assertLivePreflightSourceIdentity({
    source,
    repoRoot,
    ...(expectedSourceSha === undefined ? {} : { expectedSourceSha }),
  });
  const selection =
    expectedSourceSha === undefined
      ? resolvePreflightCanarySelection({
          source,
          selector,
        })
      : resolvePreflightCanarySelection({
          source,
          selector,
          expectedSourceSha,
        });

  const prepare = createPreflightRuntimePreparation({
    source,
    page,
    databaseUrl,
    repoRoot,
    apiUrl,
  });
  if (continuationOutputPath === undefined)
    throw new Error(
      "Preflight canary PASS requires the reveal continuation parent",
    );
  if (continuationAttemptId === undefined)
    throw new Error("Reveal continuation child requires a parent attempt id");
  if (
    (continuationInputPath === undefined) !==
    (continuationExpectedGrantDigest === undefined)
  )
    throw new Error(
      "Reveal continuation input and expected grant digest must be provided together",
    );
  const grant =
    continuationInputPath === undefined
      ? undefined
      : await readRevealContinuationGrant({
          archiveRoot,
          filePath: continuationInputPath,
        });
  if (continuationInputPath !== undefined && grant === undefined)
    throw new Error("Reveal continuation input grant is missing");
  if (continuationInputPath !== undefined) {
    if (continuationExpectedGrantDigest === undefined)
      throw new Error(
        "Reveal continuation child requires the expected sealed grant digest",
      );
    if (grant === undefined)
      throw new Error("Reveal continuation input grant is missing");
    assertRevealExecutionGrantInput({
      grant,
      expectedGrantDigest: continuationExpectedGrantDigest,
    });
    await hydrateRevealContinuationAssets({ archiveRoot, grant });
  }
  const chunk = await runPlaywrightPreflightRevealContinuationChunk({
    source,
    archiveRoot,
    state: selection.state,
    page,
    expectedOrigin: webOrigin,
    prepare,
    ...(grant === undefined ? {} : { grant }),
    attemptId: continuationAttemptId,
    ...(continuationExpectedGrantDigest === undefined
      ? {}
      : {
          expectedGrantDigest: continuationExpectedGrantDigest,
        }),
    ...(continuationDeadlineAt === undefined
      ? {}
      : { deadlineAt: Number(continuationDeadlineAt) }),
    chunkBudgetMs: continuationLimits.softWallMs,
    cooperativeLimits: {
      maxTerminalCandidates: continuationLimits.maxTerminalCandidates,
      maxRevealActionDelta: continuationLimits.maxRevealActionDelta,
    },
  });
  if (chunk.status === "BOOTSTRAP")
    await writeRevealBootstrap({
      archiveRoot,
      filePath: continuationOutputPath,
      bootstrap: chunk.bootstrap,
    });
  else
    await writeRevealReceiptChunk({
      archiveRoot,
      filePath: continuationOutputPath,
      chunk: chunk.chunk,
    });
  await expect(access(continuationOutputPath)).resolves.toBeUndefined();
});
