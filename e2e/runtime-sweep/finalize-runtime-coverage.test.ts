import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import { type CoverageCell, coverageCellSchema } from "./contracts.ts";
import {
  finalizeRuntimeCoverage,
  readCanonicalCoverageCells,
} from "./finalize-runtime-coverage.ts";
import { sha256Hex } from "./ids.ts";
import type { FrozenMatrix, MatrixExecutableCase } from "./matrix-finalizer.ts";
import { pairKeys } from "./matrix-finalizer-support.ts";

const SOURCE_SHA = "a".repeat(40);
const state = {
  profileCapability: "canonical-identities" as const,
  lifecycle: "open" as const,
  submission: "draft" as const,
  ownershipDensity: "none" as const,
  permission: "allowed" as const,
  fault: "none" as const,
  controlTransition: "none" as const,
};
const navigationAction = {
  controlKey: "route:lead/report",
  operation: "navigate" as const,
  safety: "read-only" as const,
  transition: "none" as const,
};
const matrixCase: MatrixExecutableCase = {
  caseId: "case-finalize-navigation",
  stateId: "state-finalize-navigation",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state,
  kind: "executable",
  execution: {
    kind: "navigation",
    action: navigationAction,
  },
};
const matrixBody: Omit<FrozenMatrix, "digest"> = {
  version: 1,
  sourceSha: SOURCE_SHA,
  viewport: { browser: "chromium", width: 1440, height: 900 },
  generatorSeed: "finalize-fixture",
  rows: [matrixCase],
  cases: [matrixCase],
  inapplicable: [],
  coveredPairs: [...new Set(pairKeys(matrixCase))].toSorted((a, b) =>
    a.localeCompare(b),
  ),
  counts: { executable: 1, inapplicable: 0, total: 1 },
  limits: { maxCases: 1, maxControlsPerSegment: 1 },
};
const matrix: FrozenMatrix = {
  ...matrixBody,
  digest: sha256Hex(matrixBody),
};
const cell: CoverageCell = coverageCellSchema.parse({
  cellId: matrixCase.caseId,
  sourceSha: SOURCE_SHA,
  profile: matrixCase.profile,
  role: matrixCase.role,
  catalogRoute: matrixCase.catalogRoute,
  resolvedRoute: matrixCase.resolvedRoute,
  viewport: matrix.viewport,
  state,
  action: navigationAction,
  execution: matrixCase.execution,
  faultId: null,
  oracle: {
    domainSpecRefs: ["fixture"],
    function: { required: false, expectation: "route resolves" },
    accessibility: { required: false, expectation: "controls are usable" },
    visual: { required: false, expectation: "geometry is stable" },
  },
  controls: [],
  evidence: {
    before: [],
    action: [],
    after: [],
    observations: [],
    inapplicable: [],
  },
  verdict: "pass",
});

const writeFixture = async (): Promise<string> => {
  const archiveRoot = await mkdtemp(
    path.join(os.tmpdir(), "runtime-coverage-finalize-"),
  );
  await writeFile(
    path.join(archiveRoot, "MATRIX.json"),
    JSON.stringify(matrix),
    "utf8",
  );
  const cellDirectory = path.join(
    archiveRoot,
    "cells",
    matrixCase.profile,
    matrixCase.role,
  );
  await mkdir(cellDirectory, { recursive: true });
  await writeFile(
    path.join(cellDirectory, `${matrixCase.caseId}.json`),
    JSON.stringify(cell),
    "utf8",
  );
  return archiveRoot;
};

test("finalizes exact canonical cells into one ordered immutable ledger", async () => {
  const archiveRoot = await writeFixture();
  await finalizeRuntimeCoverage({ archiveRoot });
  const ledger = await readFile(
    path.join(archiveRoot, "baseline", "coverage-cells.jsonl"),
    "utf8",
  );
  expect(coverageCellSchema.parse(JSON.parse(ledger)).cellId).toBe(
    matrixCase.caseId,
  );
});

test("reads canonical cells in ordered batches of at most 64", async () => {
  const cases = Array.from({ length: 129 }, (_, index) => ({
    ...matrixCase,
    caseId: `case-finalize-${index}`,
  }));
  const reads = { active: 0, maximum: 0, started: [] as string[] };
  const cells = await readCanonicalCoverageCells(
    "fixture",
    cases,
    async (_, matrixCaseInput) => {
      reads.active += 1;
      reads.maximum = Math.max(reads.maximum, reads.active);
      reads.started.push(matrixCaseInput.caseId);
      await Promise.resolve();
      reads.active -= 1;
      return coverageCellSchema.parse({
        ...cell,
        cellId: matrixCaseInput.caseId,
      });
    },
  );

  expect(reads.maximum).toBe(64);
  expect(reads.started).toEqual(cases.map(({ caseId }) => caseId));
  expect(cells.map(({ cellId }) => cellId)).toEqual(
    cases.map(({ caseId }) => caseId),
  );
});

test("fails closed when a frozen case projection is missing", async () => {
  const archiveRoot = await writeFixture();
  const cellPath = path.join(
    archiveRoot,
    "cells",
    matrixCase.profile,
    matrixCase.role,
    `${matrixCase.caseId}.json`,
  );
  await writeFile(cellPath, "{}", "utf8");
  await expect(finalizeRuntimeCoverage({ archiveRoot })).rejects.toThrow(
    `Cannot read canonical cell ${matrixCase.caseId}`,
  );
});

test("rejects a pre-existing immutable baseline ledger", async () => {
  const archiveRoot = await writeFixture();
  const ledgerPath = path.join(archiveRoot, "baseline", "coverage-cells.jsonl");
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, "existing\n", "utf8");
  await expect(finalizeRuntimeCoverage({ archiveRoot })).rejects.toMatchObject({
    code: "EEXIST",
  });
});
