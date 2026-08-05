import path from "node:path";

import { expect, test } from "@playwright/test";

import { seedProfileSchema } from "../source/contracts.ts";
import {
  assertFreshRuntimeManifest,
  DEFAULT_RUNTIME_MATRIX_MAX_CELLS,
  loadRuntimeMatrix,
  type RuntimeMatrixSource,
} from "./runtime-matrix.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime matrix requires ${name}`);
  return value;
};

const ARCHIVE_ROOT = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const SOURCE_SHA = requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);
const MAX_CELLS = Math.min(
  DEFAULT_RUNTIME_MATRIX_MAX_CELLS,
  Number.parseInt(
    process.env.RUNTIME_SWEEP_MAX_MATRIX_CELLS ??
      String(DEFAULT_RUNTIME_MATRIX_MAX_CELLS),
    10,
  ),
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

test("freezes the selected executable cases before live replay", async ({}, testInfo) => {
  const source = sourceHolder.value;
  if (!source) throw new Error("Runtime matrix was not prepared");
  const ids = source.selected.cases.map(({ caseId }) => caseId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    source.selected.cases.every(({ sourceSha }) => sourceSha === SOURCE_SHA),
  ).toBe(true);
  expect(
    source.selected.cases.every(({ profile }) => profile === PROFILE),
  ).toBe(true);
  await testInfo.attach(`${PROFILE}-frozen-matrix-summary.json`, {
    body: JSON.stringify(
      {
        profile: PROFILE,
        sourceSha: SOURCE_SHA,
        executableCases: source.selected.cases.length,
        executionKinds: Object.fromEntries(
          [
            ...new Set(
              source.selected.cases.map(({ execution }) => execution.kind),
            ),
          ].map((kind) => [
            kind,
            source.selected.cases.filter(
              ({ execution }) => execution.kind === kind,
            ).length,
          ]),
        ),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
