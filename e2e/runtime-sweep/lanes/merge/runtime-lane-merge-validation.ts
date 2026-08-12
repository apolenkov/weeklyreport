import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { verifyCoverageLedger } from "../../evidence/ledger.ts";
import { coverageIdentityIssues } from "../../matrix/coverage-model/matrix-coverage-identity.ts";
import type {
  FrozenMatrix,
  MatrixExecutableCase,
} from "../../matrix/matrix-finalizer.ts";
import { createFrozenCaseLiveShardPlan } from "../../replay/frozen-case/live/frozen-case-live-shards.ts";
import {
  type CoverageCell,
  coverageCellSchema,
  type EvidenceRef,
} from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";
import {
  readFileDigest,
  RUNTIME_SOURCE_FILES,
  verifyRuntimeLaneSource,
} from "../contracts/runtime-lane-files.ts";

export type AssignedLaneCase = Readonly<{
  readonly lane: RuntimeLane;
  readonly caseId: string;
}>;

export type VerifiedLaneCell = Readonly<{
  readonly assignment: AssignedLaneCase;
  readonly cell: CoverageCell;
  readonly filePath: string;
  readonly digest: string;
}>;

const inside = (root: string, candidate: string): boolean => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate !== resolvedRoot &&
    resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  );
};

const realLaneRoots = new Map<string, Promise<string>>();

const realLaneRoot = (lane: RuntimeLane): Promise<string> => {
  const existing = realLaneRoots.get(lane.archiveRoot);
  if (existing !== undefined) return existing;
  const resolved = realpath(lane.archiveRoot);
  realLaneRoots.set(lane.archiveRoot, resolved);
  return resolved;
};

const assertRegularLaneFile = async (
  lane: RuntimeLane,
  filePath: string,
): Promise<void> => {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`Runtime lane artifact is not a regular file: ${filePath}`);
  const resolved = await realpath(filePath);
  if (
    resolved !== path.resolve(filePath) ||
    !inside(await realLaneRoot(lane), resolved)
  )
    throw new Error(`Runtime lane artifact traverses a symlink: ${filePath}`);
};

const jsonFiles = async (directory: string): Promise<readonly string[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) => {
          const candidate = path.join(directory, entry.name);
          return entry.isDirectory()
            ? jsonFiles(candidate)
            : Promise.resolve(entry.name.endsWith(".json") ? [candidate] : []);
        }),
      )
    ).flat();
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return [];
    throw error;
  }
};

export const assignedLaneCases = (
  assignment: RuntimeLaneAssignment,
): readonly AssignedLaneCase[] =>
  assignment.lanes.flatMap((lane) =>
    lane.groups.flatMap(({ caseIds }) =>
      caseIds.map((caseId) => ({ lane, caseId })),
    ),
  );

const refsFor = (cell: CoverageCell): readonly EvidenceRef[] => [
  ...cell.evidence.before,
  ...cell.evidence.action,
  ...cell.evidence.after,
];

const verifyEvidenceRef = async (
  lane: RuntimeLane,
  cell: CoverageCell,
  ref: EvidenceRef,
): Promise<void> => {
  if (!inside(lane.archiveRoot, ref.archivePath))
    throw new Error(`Cell ${cell.cellId} evidence escaped lane ${lane.laneId}`);
  await assertRegularLaneFile(lane, ref.archivePath);
  if (
    ref.cellId !== cell.cellId ||
    ref.sourceSha !== cell.sourceSha ||
    ref.profile !== cell.profile ||
    ref.role !== cell.role ||
    ref.catalogRoute !== cell.catalogRoute ||
    ref.resolvedRoute !== cell.resolvedRoute
  )
    throw new Error(`Cell ${cell.cellId} contains cross-identity evidence`);
  if ((await readFileDigest(ref.archivePath)) !== ref.digest)
    throw new Error(`Cell ${cell.cellId} evidence digest mismatch`);
};

const verifyCell = async (
  matrixCase: MatrixExecutableCase,
  assignment: AssignedLaneCase,
): Promise<VerifiedLaneCell> => {
  const filePath = path.join(
    assignment.lane.archiveRoot,
    "cells",
    matrixCase.profile,
    matrixCase.role,
    `${matrixCase.caseId}.json`,
  );
  await assertRegularLaneFile(assignment.lane, filePath);
  const content = await readFile(filePath);
  const cell = coverageCellSchema.parse(JSON.parse(content.toString("utf8")));
  if (cell.verdict !== "pass")
    throw new Error(`Lane cell ${cell.cellId} verdict is ${cell.verdict}`);
  const gaps = coverageIdentityIssues(matrixCase, cell);
  if (gaps.length > 0)
    throw new Error(gaps.map(({ message }) => message).join("; "));
  await Promise.all(
    refsFor(cell).map((ref) => verifyEvidenceRef(assignment.lane, cell, ref)),
  );
  return {
    assignment,
    cell,
    filePath,
    digest: await readFileDigest(filePath),
  };
};

const MAX_CONCURRENT_CELL_CHECKS = 16;

export const mapLaneCells = async <T, R>(
  values: readonly T[],
  mapper: (value: T) => Promise<R>,
  start = 0,
): Promise<readonly R[]> => {
  const chunk = values.slice(start, start + MAX_CONCURRENT_CELL_CHECKS);
  if (chunk.length === 0) return [];
  const current = await Promise.all(chunk.map(mapper));
  const rest = await mapLaneCells(values, mapper, start + chunk.length);
  return [...current, ...rest];
};

const assertNoExtraCells = async (
  assignment: RuntimeLaneAssignment,
): Promise<void> => {
  await Promise.all(
    assignment.lanes.map(async (lane) => {
      const expected = new Set(
        lane.groups.flatMap(({ caseIds }) =>
          caseIds.map((caseId) => `${caseId}.json`),
        ),
      );
      const files = await jsonFiles(path.join(lane.archiveRoot, "cells"));
      const unexpected = files.find(
        (filePath) => !expected.has(path.basename(filePath)),
      );
      if (unexpected !== undefined)
        throw new Error(`Lane ${lane.laneId} contains an unassigned cell`);
      if (files.length !== expected.size)
        throw new Error(
          `Lane ${lane.laneId} cell count does not match assignment`,
        );
    }),
  );
};

const assertGroupAgainstMatrix = (
  assignment: RuntimeLaneAssignment,
  matrix: FrozenMatrix,
  lane: RuntimeLane,
): void => {
  const byId = new Map(matrix.cases.map((item) => [item.caseId, item]));
  lane.groups.forEach((group) => {
    group.caseIds.forEach((caseId) => {
      const matrixCase = byId.get(caseId);
      if (matrixCase?.profile !== group.profile)
        throw new Error(
          `Lane ${lane.laneId} has an invalid ${group.profile} case`,
        );
    });
    const expectedOrder = matrix.cases
      .filter(({ caseId }) => group.caseIds.includes(caseId))
      .map(({ caseId }) => caseId);
    if (stableSerialize(group.caseIds) !== stableSerialize(expectedOrder))
      throw new Error(
        `Lane ${lane.laneId}/${group.profile} changed MATRIX order`,
      );
    if (assignment.mode === "one-shard") {
      const shards = createFrozenCaseLiveShardPlan(
        matrix.cases.filter(({ profile }) => profile === group.profile),
      );
      if (
        !shards.some(
          ({ caseIds }) =>
            stableSerialize(caseIds) === stableSerialize(group.caseIds),
        )
      )
        throw new Error(`Lane ${lane.laneId} is not one complete frozen shard`);
    }
  });
};

export async function verifyRuntimeLaneInputs(
  assignment: RuntimeLaneAssignment,
): Promise<void> {
  await verifyRuntimeLaneSource(assignment);
  await Promise.all(
    assignment.lanes.flatMap((lane) =>
      RUNTIME_SOURCE_FILES.map(async ([fileName, key]) => {
        const filePath = path.join(lane.archiveRoot, fileName);
        await assertRegularLaneFile(lane, filePath);
        if (
          (await readFileDigest(filePath)) !== assignment.sourceArtifacts[key]
        )
          throw new Error(`Lane ${lane.laneId} ${fileName} digest mismatch`);
      }),
    ),
  );
}

export async function verifyRuntimeLaneCells(
  assignment: RuntimeLaneAssignment,
  matrix: FrozenMatrix,
): Promise<readonly VerifiedLaneCell[]> {
  assignment.lanes.forEach((lane) =>
    assertGroupAgainstMatrix(assignment, matrix, lane),
  );
  await assertNoExtraCells(assignment);
  const cases = assignedLaneCases(assignment);
  const byId = new Map(matrix.cases.map((item) => [item.caseId, item]));
  const verified = await mapLaneCells(cases, (entry) => {
    const matrixCase = byId.get(entry.caseId);
    if (matrixCase === undefined)
      throw new Error(`Lane assignment contains unknown case ${entry.caseId}`);
    return verifyCell(matrixCase, entry);
  });
  verifyCoverageLedger(
    verified.map(({ cell }) => cell),
    {
      sourceSha: assignment.sourceSha,
      expectedCellIds: cases.map(({ caseId }) => caseId),
      requireFinalPass: true,
    },
  );
  return verified;
}
