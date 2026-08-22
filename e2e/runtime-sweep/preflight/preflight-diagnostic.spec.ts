import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { readSourceArtifact } from "../source/source-artifact.ts";
import { assertLivePreflightSourceIdentity } from "./canary/preflight-canary-selection.ts";
import {
  diagnosticSampleForProcess,
  readOwnedDiagnosticProcesses,
} from "./diagnostics/preflight-diagnostic-sample.ts";
import {
  createDiagnosticSidecar,
  diagnosticFailureFor,
} from "./diagnostics/preflight-diagnostic-sidecar.ts";
import {
  assertDiagnosticCampaignBinding,
  DIAGNOSTIC_SAMPLE_INTERVAL_MS,
  type DiagnosticOperation,
  type DiagnosticStage,
} from "./diagnostics/preflight-diagnostic-sidecar-contract.ts";
import { runPlaywrightPreflightSegment } from "./execution/playwright-preflight.ts";
import { createPreflightRuntimePreparation } from "./runtime/preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Diagnostic preflight requires ${name}`);
  return value;
};

const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const outputRoot = path.resolve(
  requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_OUTPUT_ROOT"),
);
const stateId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_STATE_ID");
const campaignId = requiredEnv("RUNTIME_SWEEP_DIAGNOSTIC_CAMPAIGN_ID");
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;

test("diagnostic preflight captures one source-bound segment", async ({
  page,
  browser,
}) => {
  const source = await readSourceArtifact(sourcePath);
  const state = source.plan.states.find(
    (candidate) => candidate.stateId === stateId,
  );
  if (state === undefined)
    throw new Error(
      `Diagnostic state is not present in SOURCE.json: ${stateId}`,
    );
  expect(state.stateId).toBe(stateId);
  await assertLivePreflightSourceIdentity({ source, repoRoot });

  const sidecar = createDiagnosticSidecar({
    enabled: true,
    archiveRoot,
    outputRoot,
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    campaignId,
  });
  assertDiagnosticCampaignBinding({
    requestedCampaignId: campaignId,
    sourceCampaignId: source.campaignId,
  });
  const initialProcesses = await readOwnedDiagnosticProcesses();
  const currentProcess = initialProcesses[0];
  if (currentProcess === undefined)
    throw new Error(
      "Diagnostic process sampler did not return the Playwright child",
    );
  let secondaryError: Error | undefined;
  const rememberSecondaryError = (error: unknown): void => {
    if (secondaryError !== undefined) return;
    secondaryError = error instanceof Error ? error : new Error(String(error));
  };
  const recordSafely = (promise: Promise<void>): void => {
    void promise.catch(rememberSecondaryError);
  };
  const phaseState: {
    stage: DiagnosticStage;
    operation: DiagnosticOperation;
  } = { stage: "launch", operation: "none" };
  const setPhase = (
    stage: DiagnosticStage,
    operation: DiagnosticOperation,
  ): void => {
    phaseState.stage = stage;
    phaseState.operation = operation;
  };
  const startedAt = Date.now();
  const recordSamples = async (): Promise<void> => {
    const processes = await readOwnedDiagnosticProcesses();
    await Promise.all(
      processes.map((processSnapshot) =>
        sidecar.record(
          diagnosticSampleForProcess({
            recordKind: "sample",
            elapsedMs: Date.now() - startedAt,
            stage: phaseState.stage,
            currentOperation: phaseState.operation,
            failureKind: "none",
            process: processSnapshot,
          }),
        ),
      ),
    );
  };
  let sampleTask = Promise.resolve();
  let eventTask = Promise.resolve();
  const scheduleSamples = (): void => {
    sampleTask = sampleTask.then(recordSamples);
    recordSafely(sampleTask);
  };
  scheduleSamples();
  const sampleTimer = setInterval(() => {
    scheduleSamples();
  }, DIAGNOSTIC_SAMPLE_INTERVAL_MS);
  const recordEvent = (
    stage: Parameters<typeof diagnosticSampleForProcess>[0]["stage"],
    currentOperation: Parameters<
      typeof diagnosticSampleForProcess
    >[0]["currentOperation"],
    failureKind: Parameters<
      typeof diagnosticSampleForProcess
    >[0]["failureKind"],
  ): void => {
    const next = eventTask.then(() =>
      sidecar.record(
        diagnosticSampleForProcess({
          recordKind: "event",
          elapsedMs: Date.now() - startedAt,
          stage,
          currentOperation,
          failureKind,
          process: currentProcess,
        }),
      ),
    );
    eventTask = next.catch(rememberSecondaryError);
  };
  page.on("crash", () => recordEvent("failure", "wait-reveal", "page-crash"));
  page.on("close", () => recordEvent("cleanup", "cleanup", "page-close"));
  browser.on("disconnected", () =>
    recordEvent("failure", "cleanup", "browser-disconnected"),
  );

  let originalError: Error | undefined;
  try {
    await sidecar.record(
      diagnosticSampleForProcess({
        recordKind: "event",
        elapsedMs: Date.now() - startedAt,
        stage: "launch",
        currentOperation: "none",
        failureKind: "none",
        process: currentProcess,
      }),
    );
    const basePrepare = createPreflightRuntimePreparation({
      source,
      page,
      databaseUrl,
      repoRoot,
      apiUrl,
    });
    const prepare: typeof basePrepare = Object.assign(
      async (...args: Parameters<typeof basePrepare>) => {
        setPhase("prepare", "prepare");
        const result = await basePrepare(...args);
        setPhase("navigate", "navigate");
        return result;
      },
      { recreateDisposableBoundary: basePrepare.recreateDisposableBoundary },
    );
    await sidecar.record(
      diagnosticSampleForProcess({
        recordKind: "event",
        elapsedMs: Date.now() - startedAt,
        stage: "prepare",
        currentOperation: "prepare",
        failureKind: "none",
        process: currentProcess,
      }),
    );
    await runPlaywrightPreflightSegment({
      source,
      state,
      page,
      expectedOrigin: webOrigin,
      prepare,
      resetRequired: true,
      onPhase: setPhase,
    });
    setPhase("inventory", "inventory");
    await sidecar.record(
      diagnosticSampleForProcess({
        recordKind: "event",
        elapsedMs: Date.now() - startedAt,
        stage: "inventory",
        currentOperation: "inventory",
        failureKind: "none",
        process: currentProcess,
      }),
    );
  } catch (error: unknown) {
    setPhase("failure", "wait-reveal");
    originalError = error instanceof Error ? error : new Error(String(error));
    recordEvent("failure", "wait-reveal", "playwright-error");
  } finally {
    setPhase("cleanup", "cleanup");
    clearInterval(sampleTimer);
    recordEvent("cleanup", "cleanup", "none");
    try {
      await sampleTask;
      await eventTask;
      await sidecar.finalize();
    } catch (error: unknown) {
      rememberSecondaryError(error);
      try {
        await sidecar.closeWithoutManifest();
      } catch (closeError: unknown) {
        rememberSecondaryError(closeError);
      }
    }
  }
  const terminalError = diagnosticFailureFor(originalError, secondaryError);
  if (terminalError !== undefined) throw terminalError;
});
