import { constants } from "node:fs";
import { copyFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { finalizeRuntimeCoverage } from "../evidence/finalize-runtime-coverage.ts";
import {
  readCoverageLedger,
  verifyCoverageLedger,
} from "../evidence/ledger.ts";
import type { RuntimeLaneAssignment } from "./runtime-lane-contract.ts";
import {
  assertArchiveChildAfterCreate,
  assertArchiveChildBeforeCreate,
  readFileDigest,
  RUNTIME_SOURCE_FILES,
} from "./runtime-lane-files.ts";
import {
  mapLaneCells,
  type VerifiedLaneCell,
} from "./runtime-lane-merge-validation.ts";

const canonicalCellPath = (
  archiveRoot: string,
  verified: VerifiedLaneCell,
): string =>
  path.join(
    archiveRoot,
    "cells",
    verified.cell.profile,
    verified.cell.role,
    `${verified.cell.cellId}.json`,
  );

const copyStagingCell = async (
  staging: string,
  verified: VerifiedLaneCell,
): Promise<void> => {
  const target = canonicalCellPath(staging, verified);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(verified.filePath, target, constants.COPYFILE_EXCL);
  if ((await readFileDigest(target)) !== verified.digest)
    throw new Error(`Staging cell digest changed: ${verified.cell.cellId}`);
};

const prepareStaging = async (
  assignment: RuntimeLaneAssignment,
): Promise<string> => {
  const parent = path.join(assignment.sourceArchiveRoot, "merge-staging");
  const staging = path.join(parent, assignment.assignmentDigest);
  await assertArchiveChildBeforeCreate(assignment.sourceArchiveRoot, staging);
  await mkdir(parent, { recursive: true });
  await mkdir(staging);
  await assertArchiveChildAfterCreate(assignment.sourceArchiveRoot, staging);
  await Promise.all(
    RUNTIME_SOURCE_FILES.map(async ([fileName, key]) => {
      const target = path.join(staging, fileName);
      await copyFile(
        path.join(assignment.sourceArchiveRoot, fileName),
        target,
        constants.COPYFILE_EXCL,
      );
      if ((await readFileDigest(target)) !== assignment.sourceArtifacts[key])
        throw new Error(`Staging source digest changed: ${fileName}`);
    }),
  );
  return staging;
};

export async function publishRuntimeLaneMerge(
  assignment: RuntimeLaneAssignment,
  verified: readonly VerifiedLaneCell[],
  expectedCaseIds: readonly string[],
): Promise<void> {
  const staging = await prepareStaging(assignment);
  await mapLaneCells(verified, (cell) => copyStagingCell(staging, cell));
  await finalizeRuntimeCoverage({ archiveRoot: staging });
  const ledger = await readCoverageLedger(
    path.join(staging, "baseline", "coverage-cells.jsonl"),
  );
  verifyCoverageLedger(ledger, {
    sourceSha: assignment.sourceSha,
    expectedCellIds: expectedCaseIds,
    requireFinalPass: true,
  });
  await rename(
    path.join(staging, "cells"),
    path.join(assignment.sourceArchiveRoot, "cells"),
  );
  await rename(
    path.join(staging, "baseline"),
    path.join(assignment.sourceArchiveRoot, "baseline"),
  );
}
