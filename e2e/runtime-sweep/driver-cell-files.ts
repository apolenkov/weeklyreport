import { readFile } from "node:fs/promises";
import path from "node:path";

import { type CoverageCell, coverageCellSchema } from "./contracts.ts";
import { DriverAssignmentError } from "./driver-errors.ts";
import {
  assertExactDriverShardCaseIds,
  type DriverShardAssignment,
} from "./driver-shards.ts";
import { stableSerialize } from "./ids.ts";

const cellIssues = (
  cell: CoverageCell,
  caseId: string,
  shard: DriverShardAssignment,
): readonly string[] => [
  ...(cell.cellId === caseId
    ? []
    : [`${caseId} file contains non-canonical cell id ${cell.cellId}`]),
  ...(cell.sourceSha === shard.sourceSha
    ? []
    : [`${caseId} has stale source SHA ${cell.sourceSha}`]),
  ...(cell.profile === shard.profile
    ? []
    : [`${caseId} has stale profile ${cell.profile}`]),
  ...(cell.role === shard.role
    ? []
    : [`${caseId} has stale role ${cell.role}`]),
  ...(cell.catalogRoute === shard.catalogRoute
    ? []
    : [`${caseId} has stale catalog route ${cell.catalogRoute}`]),
  ...(cell.resolvedRoute === shard.resolvedRoute
    ? []
    : [`${caseId} has stale resolved route ${cell.resolvedRoute}`]),
  ...(stableSerialize(cell.state) === stableSerialize(shard.state)
    ? []
    : [`${caseId} has stale frozen state`]),
];

export async function readAssignedCells(
  archive: string,
  shard: DriverShardAssignment,
): Promise<readonly CoverageCell[]> {
  const directory = path.join(archive, "cells", shard.profile, shard.role);
  const cells = await Promise.all(
    shard.caseIds.map(async (caseId) => {
      const filePath = path.join(directory, `${caseId}.json`);
      try {
        const cell = coverageCellSchema.parse(
          JSON.parse(await readFile(filePath, "utf8")),
        );
        const issues = cellIssues(cell, caseId, shard);
        if (issues.length > 0)
          throw new DriverAssignmentError(issues.join("; "));
        return cell;
      } catch (error: unknown) {
        if (error instanceof DriverAssignmentError) throw error;
        throw new DriverAssignmentError(
          `Missing or invalid runtime cell for assigned case ${caseId}: ${filePath}`,
          { cause: error },
        );
      }
    }),
  );
  assertExactDriverShardCaseIds(
    shard,
    cells.map(({ cellId }) => cellId),
  );
  return cells;
}
