import { access } from "node:fs/promises";
import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { readSourceArtifact } from "../source/source-artifact.ts";
import { stableSerialize } from "../support/ids.ts";
import {
  assertLivePreflightSourceIdentity,
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCampaignKind,
  resolvePreflightCanarySelection,
} from "./canary/preflight-canary.ts";
import { assertCapacitySurveyPlanMatchesSource } from "./capacity/preflight-capacity-survey-contract.ts";
import { readCapacitySurveyPlan } from "./capacity/preflight-capacity-survey-io.ts";
import { runPlaywrightPreflightRevealContinuationChunk } from "./execution/playwright-preflight-continuation.ts";
import { assertPreflightArchivePath } from "./preflight-archive-path.ts";
import {
  hydrateRevealContinuationAssets,
  readRevealContinuationGrant,
  writeRevealBootstrap,
  writeRevealReceiptChunk,
} from "./reveal/continuation/preflight-reveal-continuation-io.ts";
import { assertRevealExecutionGrantInput } from "./reveal/continuation/preflight-reveal-continuation-runner.ts";
import {
  assertFailureFrontierManifestAbsent,
  createRevealFailureFrontierHandler,
} from "./reveal/failure-frontier/preflight-reveal-failure-frontier.ts";
import type { RevealCandidateFailureHandler } from "./reveal/interaction/preflight-reveal-branches.ts";
import { createPreflightRuntimePreparation } from "./runtime/preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight canary requires ${name}`);
  return value;
};

const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
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

const optionalFailureFrontierHandlerFor = async (input: {
  readonly source: Awaited<ReturnType<typeof readSourceArtifact>>;
  readonly selection: ReturnType<typeof resolvePreflightCanarySelection>;
}): Promise<RevealCandidateFailureHandler | undefined> => {
  const packetRoot =
    process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_FAILURE_FRONTIER_ROOT?.trim();
  const planPath =
    process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_FAILURE_FRONTIER_PLAN?.trim();
  if ((packetRoot === undefined) !== (planPath === undefined))
    throw new Error(
      "Failure-frontier continuation capture requires both packet root and capacity plan",
    );
  if (packetRoot === undefined || planPath === undefined) return undefined;
  const exactPacketRoot = path.resolve(packetRoot);
  const exactPlanPath = path.resolve(planPath);
  const planRelativeToPacket = path.relative(exactPacketRoot, exactPlanPath);
  if (
    planRelativeToPacket === "" ||
    (!planRelativeToPacket.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(planRelativeToPacket))
  )
    throw new Error(
      "Failure-frontier continuation capacity plan must remain outside the packet root",
    );
  await assertPreflightArchivePath(
    archiveRoot,
    path.join(exactPacketRoot, ".failure-frontier-boundary"),
  );
  await assertPreflightArchivePath(archiveRoot, exactPlanPath);
  const plan = await readCapacitySurveyPlan({
    archiveRoot,
    filePath: exactPlanPath,
  });
  assertCapacitySurveyPlanMatchesSource(plan, {
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    treeDigest: input.source.treeDigest,
    sourceDigest: input.source.sourceDigest,
    planDigest: input.source.plan.digest,
  });
  if (
    stableSerialize(plan.state) !== stableSerialize(input.selection.state) ||
    stableSerialize(plan.route) !== stableSerialize(input.selection.route)
  )
    throw new Error(
      "Failure-frontier continuation capture plan does not match the canary selection",
    );
  await assertFailureFrontierManifestAbsent(exactPacketRoot);
  return createRevealFailureFrontierHandler({
    packetRoot: exactPacketRoot,
    plan,
    beforeCapture: () =>
      assertLivePreflightSourceIdentity({
        source: input.source,
        repoRoot,
        expectedSourceSha: plan.sourceSha,
      }).then(() => undefined),
  });
};

test("exact-state preflight canary reuses the full segment runner", async ({
  page,
}) => {
  const source = await readSourceArtifact(sourcePath);
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

  const onCandidateFailure = await optionalFailureFrontierHandlerFor({
    source,
    selection,
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
    chunkBudgetMs: Number(
      process.env.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_CHUNK_MS ??
        String(30 * 60_000),
    ),
    ...(onCandidateFailure === undefined ? {} : { onCandidateFailure }),
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
