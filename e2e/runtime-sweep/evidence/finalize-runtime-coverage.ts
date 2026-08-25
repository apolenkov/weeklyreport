import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertFrozenMatrixCoverage } from "../matrix/coverage-model/matrix-coverage.ts";
import {
  type FrozenMatrix,
  parseFrozenMatrix,
} from "../matrix/matrix-finalizer.ts";
import { type CoverageCell, coverageCellSchema } from "../source/contracts.ts";
import { writeOrderedCoverageLedger } from "./ledger.ts";

export class RuntimeCoverageFinalizationError extends Error {
  override readonly name = "RuntimeCoverageFinalizationError";
}

const MAX_CONCURRENT_CELL_READS = 64;

const readMatrix = async (archiveRoot: string): Promise<FrozenMatrix> => {
  const matrixPath = path.join(path.resolve(archiveRoot), "MATRIX.json");
  try {
    return parseFrozenMatrix(JSON.parse(await readFile(matrixPath, "utf8")));
  } catch (error: unknown) {
    throw new RuntimeCoverageFinalizationError(
      `Cannot read frozen MATRIX.json: ${error instanceof Error ? error.message : "invalid matrix"}`,
    );
  }
};

const cellPath = (
  archiveRoot: string,
  cell: FrozenMatrix["cases"][number],
): string =>
  path.join(
    path.resolve(archiveRoot),
    "cells",
    cell.profile,
    cell.role,
    `${cell.caseId}.json`,
  );

const readCell = async (
  archiveRoot: string,
  matrixCase: FrozenMatrix["cases"][number],
): Promise<CoverageCell> => {
  const filePath = cellPath(archiveRoot, matrixCase);
  try {
    return coverageCellSchema.parse(
      JSON.parse(await readFile(filePath, "utf8")),
    );
  } catch (error: unknown) {
    throw new RuntimeCoverageFinalizationError(
      `Cannot read canonical cell ${matrixCase.caseId}: ${error instanceof Error ? error.message : "invalid cell"}`,
    );
  }
};

type CoverageCellReader = (
  archiveRoot: string,
  matrixCase: FrozenMatrix["cases"][number],
) => Promise<CoverageCell>;

interface CoverageCellReadRange {
  readonly archiveRoot: string;
  readonly matrixCases: readonly FrozenMatrix["cases"][number][];
  readonly reader: CoverageCellReader;
  readonly start: number;
  readonly end: number;
}

const readCanonicalCoverageRange = async (
  input: CoverageCellReadRange,
): Promise<readonly CoverageCell[]> => {
  const count = input.end - input.start;
  if (count <= MAX_CONCURRENT_CELL_READS)
    return Promise.all(
      input.matrixCases
        .slice(input.start, input.end)
        .map((matrixCase) => input.reader(input.archiveRoot, matrixCase)),
    );
  const midpoint = input.start + Math.floor(count / 2);
  const left = await readCanonicalCoverageRange({
    ...input,
    end: midpoint,
  });
  const right = await readCanonicalCoverageRange({
    ...input,
    start: midpoint,
  });
  return [...left, ...right];
};

export const readCanonicalCoverageCells = async (
  archiveRoot: string,
  matrixCases: readonly FrozenMatrix["cases"][number][],
  reader: CoverageCellReader = readCell,
): Promise<readonly CoverageCell[]> =>
  readCanonicalCoverageRange({
    archiveRoot,
    matrixCases,
    reader,
    start: 0,
    end: matrixCases.length,
  });

export async function finalizeRuntimeCoverage(input: {
  readonly archiveRoot: string;
  readonly ledgerPath?: string;
}): Promise<readonly CoverageCell[]> {
  const matrix = await readMatrix(input.archiveRoot);
  const cells = await readCanonicalCoverageCells(
    input.archiveRoot,
    matrix.cases,
  );
  assertFrozenMatrixCoverage(matrix, cells);
  await writeOrderedCoverageLedger(
    input.ledgerPath ??
      path.join(input.archiveRoot, "baseline", "coverage-cells.jsonl"),
    cells,
    {
      sourceSha: matrix.sourceSha,
      expectedCellIds: matrix.cases.map(({ caseId }) => caseId),
    },
  );
  return cells;
}
