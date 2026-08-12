import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { readSourceArtifact } from "../source/source-artifact.ts";
import { runPlaywrightPreflightSegment } from "./playwright-preflight.ts";
import {
  assertLivePreflightSourceIdentity,
  createPreflightCanaryBlocked,
  createPreflightCanaryFailure,
  createPreflightCanaryPass,
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCampaignKind,
  resolvePreflightCanarySelection,
  writePreflightCanaryArtifact,
} from "./preflight-canary.ts";
import { createPreflightRuntimePreparation } from "./preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight canary requires ${name}`);
  return value;
};

const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
const canaryPath = path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT_CANARY"));
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;

const expectedSourceSha = process.env.RUNTIME_SWEEP_CANARY_SOURCE_SHA?.trim();

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

  let selection!: ReturnType<typeof resolvePreflightCanarySelection>;
  try {
    await assertLivePreflightSourceIdentity({
      source,
      repoRoot,
      ...(expectedSourceSha === undefined ? {} : { expectedSourceSha }),
    });
    selection =
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
  } catch (error: unknown) {
    await writePreflightCanaryArtifact(
      canaryPath,
      createPreflightCanaryBlocked({
        source,
        selector,
        error,
      }),
    );
    throw error;
  }

  const prepare = createPreflightRuntimePreparation({
    source,
    page,
    databaseUrl,
    repoRoot,
    apiUrl,
  });
  let result!: Awaited<ReturnType<typeof runPlaywrightPreflightSegment>>;
  try {
    result = await runPlaywrightPreflightSegment({
      source,
      state: selection.state,
      page,
      expectedOrigin: webOrigin,
      prepare,
      resetRequired: true,
    });
  } catch (error: unknown) {
    await writePreflightCanaryArtifact(
      canaryPath,
      createPreflightCanaryFailure({
        source,
        selection,
        error,
      }),
    );
    throw error;
  }

  const artifact = createPreflightCanaryPass({
    source,
    selection,
    segment: result.segment,
  });
  await writePreflightCanaryArtifact(canaryPath, artifact);
  expect(artifact.status).toBe("PASS");
});
