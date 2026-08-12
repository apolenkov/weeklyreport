import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { readSourceArtifact } from "../source/source-artifact.ts";
import { runPlaywrightPreflightSegment } from "./playwright-preflight.ts";
import {
  assertPreflightAssignmentMatchesSource,
  readPreflightAssignment,
} from "./preflight-assignment.ts";
import { assertLivePreflightSourceIdentity } from "./preflight-canary.ts";
import { runJournaledPreflight } from "./preflight-journal-runner.ts";
import { createPreflightRuntimePreparation } from "./preflight-runtime-setup.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
const preflightPath = path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT"));
const assignmentPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT"),
);
const journalPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_JOURNAL"),
);
const segmentRoot = path.resolve(
  requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SEGMENTS"),
);
const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const apiUrl = `http://127.0.0.1:${requiredEnv("E2E_API_PORT")}`;
const webOrigin = `http://127.0.0.1:${requiredEnv("E2E_WEB_PORT")}`;
test("preflight prepares and inventories every nominal source segment", async ({
  page,
}) => {
  const source = await readSourceArtifact(sourcePath);
  const assignment = await readPreflightAssignment(assignmentPath);
  assertPreflightAssignmentMatchesSource(source, assignment);
  const prepare = createPreflightRuntimePreparation({
    source,
    page,
    databaseUrl,
    repoRoot,
    apiUrl,
  });
  const result = await runJournaledPreflight({
    source,
    assignment,
    assignmentPath,
    archiveRoot,
    journalPath,
    segmentRoot,
    preflightPath,
    assertLiveSource: () =>
      assertLivePreflightSourceIdentity({ source, repoRoot }).then(
        () => undefined,
      ),
    recreateDisposableBoundary: prepare.recreateDisposableBoundary,
    readSource: () => readSourceArtifact(sourcePath),
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
  expect(result.artifact.segments).toHaveLength(source.plan.states.length);
  expect(result.artifact.sourceDigest).toBe(source.sourceDigest);
});
