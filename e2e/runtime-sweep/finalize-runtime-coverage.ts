import { readFile } from "node:fs/promises";
import path from "node:path";

import { type CoverageCell, coverageCellSchema } from "./contracts.ts";
import { writeOrderedCoverageLedger } from "./ledger.ts";
import { assertFrozenMatrixCoverage } from "./matrix-coverage.ts";
import { type FrozenMatrix, parseFrozenMatrix } from "./matrix-finalizer.ts";

export class RuntimeCoverageFinalizationError extends Error {
  override readonly name = "RuntimeCoverageFinalizationError";
}

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

export async function finalizeRuntimeCoverage(input: {
  readonly archiveRoot: string;
  readonly ledgerPath?: string;
}): Promise<readonly CoverageCell[]> {
  const matrix = await readMatrix(input.archiveRoot);
  const cells = await Promise.all(
    matrix.cases.map((matrixCase) => readCell(input.archiveRoot, matrixCase)),
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
