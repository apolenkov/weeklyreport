import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseFrozenMatrix } from "../matrix/matrix-finalizer.ts";
import { SEED_PROFILES } from "../source/contracts.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import type { RuntimeLaneAssignment } from "./runtime-lane-contract.ts";
import { publishRuntimeLaneMerge } from "./runtime-lane-merge-publication.ts";
import {
  assignedLaneCases,
  verifyRuntimeLaneCells,
  verifyRuntimeLaneInputs,
} from "./runtime-lane-merge-validation.ts";
import { verifyRuntimeLaneObservability } from "./runtime-lane-observability-validation.ts";

const compareStrings = (left: string, right: string): number =>
  left.localeCompare(right);

const assertFullCoverageAssignment = (
  assignment: RuntimeLaneAssignment,
  matrixCaseIds: readonly string[],
): void => {
  if (assignment.mode !== "full") return;
  if (stableSerialize(assignment.profiles) !== stableSerialize(SEED_PROFILES))
    throw new Error("Full lane merge requires all canonical profiles in order");
  const expected = matrixCaseIds.toSorted(compareStrings);
  const actual = assignedLaneCases(assignment)
    .map(({ caseId }) => caseId)
    .toSorted(compareStrings);
  if (stableSerialize(actual) !== stableSerialize(expected))
    throw new Error(
      "Full lane assignment does not cover frozen MATRIX exactly",
    );
};

export async function mergeRuntimeLanes(
  input: Readonly<{
    readonly assignment: RuntimeLaneAssignment;
    readonly reportPath: string;
  }>,
): Promise<Readonly<{ readonly cells: number; readonly digest: string }>> {
  await verifyRuntimeLaneInputs(input.assignment);
  const observability = await verifyRuntimeLaneObservability(input.assignment);
  const matrix = parseFrozenMatrix(
    JSON.parse(
      await readFile(
        path.join(input.assignment.sourceArchiveRoot, "MATRIX.json"),
        "utf8",
      ),
    ),
  );
  if (
    matrix.sourceSha !== input.assignment.sourceSha ||
    matrix.digest !== input.assignment.matrixDigest
  )
    throw new Error("Lane assignment does not match frozen MATRIX");
  assertFullCoverageAssignment(
    input.assignment,
    matrix.cases.map(({ caseId }) => caseId),
  );
  const verified = await verifyRuntimeLaneCells(input.assignment, matrix);
  if (input.assignment.mode === "full")
    await publishRuntimeLaneMerge(
      input.assignment,
      verified,
      matrix.cases.map(({ caseId }) => caseId),
    );
  const result = {
    artifact: "RUNTIME_LANE_MERGE",
    version: 1,
    sourceSha: input.assignment.sourceSha,
    matrixDigest: input.assignment.matrixDigest,
    assignmentDigest: input.assignment.assignmentDigest,
    runId: observability.runId,
    observabilityDigest: observability.digest,
    mode: input.assignment.mode,
    cells: verified.length,
    cellDigest: sha256Hex(
      verified.map(({ cell, digest }) => ({ cellId: cell.cellId, digest })),
    ),
  } as const;
  await writeFile(input.reportPath, `${stableSerialize(result)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  if (input.assignment.mode === "full")
    await writeFile(
      path.join(input.assignment.sourceArchiveRoot, "MERGE-COMPLETE.json"),
      `${stableSerialize(result)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
  return { cells: result.cells, digest: result.cellDigest };
}
