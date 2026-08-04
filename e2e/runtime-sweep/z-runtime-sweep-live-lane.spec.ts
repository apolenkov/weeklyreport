import path from "node:path";

import { expect, test } from "@playwright/test";

import { seedProfileSchema } from "./contracts.ts";
import {
  type FrozenCaseLiveRuntime,
  runFrozenCases,
} from "./frozen-case-live-runner.ts";
import {
  assertFreshRuntimeManifest,
  loadRuntimeMatrix,
  type RuntimeMatrixSource,
} from "./runtime-matrix.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime live-control lane requires ${name}`);
  return value;
};

const ARCHIVE_ROOT = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const SOURCE_SHA = requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
const PROFILE = seedProfileSchema.parse(requiredEnv("RUNTIME_SWEEP_PROFILE"));
const DATABASE_URL = requiredEnv("E2E_DATABASE_URL");
const BASE_URL = requiredEnv("RUNTIME_SWEEP_BASE_URL");
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const MAX_CELLS = Number.parseInt(
  process.env.RUNTIME_SWEEP_MAX_MATRIX_CELLS ?? "1000",
  10,
);

const sourceHolder: { value?: RuntimeMatrixSource } = {};

test.beforeAll(async () => {
  const source = await loadRuntimeMatrix({
    archiveRoot: ARCHIVE_ROOT,
    profile: PROFILE,
    maxCells: MAX_CELLS,
  });
  if (source.manifest.sourceSha !== SOURCE_SHA)
    throw new Error(
      `Runtime matrix source SHA mismatch: manifest=${source.manifest.sourceSha}, env=${SOURCE_SHA}`,
    );
  assertFreshRuntimeManifest(source);
  sourceHolder.value = source;
});

test("replays every frozen runtime case into its canonical evidence cell", async ({
  page,
}, testInfo) => {
  const source = sourceHolder.value;
  if (!source) throw new Error("Runtime matrix was not prepared");
  const runtime: FrozenCaseLiveRuntime = {
    archiveRoot: ARCHIVE_ROOT,
    baseURL: BASE_URL,
    databaseUrl: DATABASE_URL,
    repoRoot: REPO_ROOT,
  };
  const cells = await runFrozenCases(
    page,
    source,
    source.selected.cases,
    runtime,
    testInfo,
  );
  await testInfo.attach(`${PROFILE}-frozen-runtime-matrix-summary.json`, {
    body: JSON.stringify(
      {
        profile: PROFILE,
        cases: source.selected.cases.length,
        cells: cells.map(({ cellId, execution, verdict }) => ({
          cellId,
          execution: execution.kind,
          verdict,
        })),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(cells.map(({ cellId }) => cellId)).toEqual(
    source.selected.cases.map(({ caseId }) => caseId),
  );
  expect(cells.filter(({ verdict }) => verdict !== "pass")).toHaveLength(0);
});
