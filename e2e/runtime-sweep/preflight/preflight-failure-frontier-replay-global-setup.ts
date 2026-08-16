import * as path from "node:path";

import {
  type Browser,
  type BrowserContextOptions,
  chromium,
  devices,
} from "@playwright/test";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { readSourceArtifact } from "../source/source-artifact.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary.ts";
import {
  assertCapacitySurveyPlanMatchesSource,
  type CapacitySurveyPlan,
} from "./capacity/preflight-capacity-survey-contract.ts";
import { readCapacitySurveyPlan } from "./capacity/preflight-capacity-survey-io.ts";
import { playwrightHarnessFor } from "./execution/playwright-preflight.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";
import { readRevealFailureFrontierPacket } from "./reveal/failure-frontier/preflight-reveal-failure-frontier.ts";
import {
  classifyFailureFrontierReplay,
  emitFailureFrontierReplayClassification,
  type ValidatedFailureFrontierReplay,
} from "./reveal/failure-frontier/preflight-reveal-failure-frontier-classification.ts";
import { replayFailureFrontierWithBrowserHarness } from "./reveal/failure-frontier/preflight-reveal-failure-frontier-playwright.ts";
import type { RevealFailureFrontierReplayClassification } from "./reveal/failure-frontier/preflight-reveal-failure-frontier-replay.ts";
import { createPreflightRuntimePreparation } from "./runtime/preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Failure-frontier replay requires ${name}`);
  return value;
};

const validatedReplayFromEnvironment =
  async (): Promise<ValidatedFailureFrontierReplay> => {
    const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
    const archiveRoot = await ensurePreflightArchiveRoot(
      path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE")),
    );
    const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
    const planPath = path.resolve(
      requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN"),
    );
    const packetRoot = path.resolve(
      requiredEnv("RUNTIME_SWEEP_FAILURE_FRONTIER_REPLAY_PACKET_ROOT"),
    );
    await Promise.all([
      assertPreflightArchivePath(archiveRoot, sourcePath),
      assertPreflightArchivePath(archiveRoot, planPath),
      assertPreflightArchivePath(
        archiveRoot,
        path.join(packetRoot, "FAILURE_FRONTIER.json"),
      ),
    ]);
    const source = await readSourceArtifact(sourcePath);
    const plan = await readCapacitySurveyPlan({
      archiveRoot,
      filePath: planPath,
    });
    assertCapacitySurveyPlanMatchesSource(plan, {
      sourceSha: source.sourceSha,
      sourceTree: source.sourceTree,
      treeDigest: source.treeDigest,
      sourceDigest: source.sourceDigest,
      planDigest: source.plan.digest,
    });
    const packet = await readRevealFailureFrontierPacket({
      packetRoot,
      expectedPlan: plan,
    });
    await assertLivePreflightSourceIdentity({
      source,
      repoRoot,
      expectedSourceSha: plan.sourceSha,
    });
    return { source, plan, packet };
  };

const { defaultBrowserType: _defaultBrowserType, ...desktopChrome } =
  devices["Desktop Chrome"];

const contextOptionsFor = (
  plan: CapacitySurveyPlan,
): BrowserContextOptions => ({
  ...desktopChrome,
  reducedMotion: "reduce",
  viewport: { width: plan.viewport.width, height: plan.viewport.height },
  baseURL: `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`,
});

const replayInFreshBrowser = async (
  validated: ValidatedFailureFrontierReplay,
  browser: Browser,
): Promise<RevealFailureFrontierReplayClassification> => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
  const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;
  const context = await browser.newContext(contextOptionsFor(validated.plan));
  try {
    const page = await context.newPage();
    const prepare = createPreflightRuntimePreparation({
      source: validated.source,
      page,
      databaseUrl: requiredEnv("E2E_DATABASE_URL"),
      repoRoot,
      apiUrl,
      maxRevealDepth: validated.plan.limits.maxDepth,
    });
    return await replayFailureFrontierWithBrowserHarness({
      plan: validated.plan,
      packet: validated.packet,
      harness: playwrightHarnessFor({
        source: validated.source,
        page,
        expectedOrigin: webOrigin,
        prepare,
      }),
    });
  } finally {
    await context.close();
  }
};

export default async function runFailureFrontierReplayGlobalSetup(): Promise<void> {
  assertE2eRuntimeDestructiveTarget(
    "runtime-failure-frontier-replay-global-setup",
    requiredEnv("E2E_DATABASE_URL"),
    process.env,
  );
  const classification = await classifyFailureFrontierReplay({
    validate: validatedReplayFromEnvironment,
    replay: async (validated) => {
      const browser = await chromium.launch({ headless: true });
      try {
        return await replayInFreshBrowser(validated, browser);
      } finally {
        await browser.close();
      }
    },
  });
  emitFailureFrontierReplayClassification(classification);
}
