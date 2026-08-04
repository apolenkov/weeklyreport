import type { CoverageCell, Role, SeedProfile } from "./contracts.ts";
import { stableSerialize } from "./ids.ts";
import {
  coverageIdentityIssues,
  isSpecializedCoverageCase,
  sameNominalCoverageWitness,
} from "./matrix-coverage-identity.ts";
import type { FrozenMatrix, MatrixExecutableCase } from "./matrix-finalizer.ts";
import { pairKeys } from "./matrix-finalizer-support.ts";

export {
  excludedStateCombinations,
  stateCapabilities,
  witnessCapability,
} from "./matrix-coverage-requirements.ts";

export type MatrixCoverageIssueKind =
  | "missing-case"
  | "missing-specialized-case"
  | "extra-case"
  | "duplicate-case"
  | "inapplicable-case"
  | "identity-mismatch"
  | "fabricated-none-witness"
  | "pair-gap"
  | "order-mismatch";

export interface MatrixCoverageGap {
  readonly kind: MatrixCoverageIssueKind;
  readonly message: string;
  readonly caseId?: string;
  readonly profile?: SeedProfile;
  readonly role?: Role;
  readonly route?: string;
  readonly requirement?: string;
}

export class FrozenMatrixCoverageError extends Error {
  override readonly name = "FrozenMatrixCoverageError";

  constructor(readonly gaps: readonly MatrixCoverageGap[]) {
    super(
      `Frozen MATRIX coverage rejected: ${gaps.map(({ message }) => message).join("; ")}`,
    );
  }
}

const gap = (
  kind: MatrixCoverageIssueKind,
  message: string,
  details: Readonly<Partial<MatrixCoverageGap>> = {},
): MatrixCoverageGap => ({ kind, message, ...details });

const duplicateIds = (ids: readonly string[]): readonly string[] => [
  ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
];

const pairGaps = (
  matrix: FrozenMatrix,
  coveredCases: readonly MatrixExecutableCase[],
): readonly MatrixCoverageGap[] => {
  const covered = new Set(coveredCases.flatMap(pairKeys));
  return matrix.coveredPairs
    .filter((requirement) => !covered.has(requirement))
    .map((requirement) =>
      gap("pair-gap", `Frozen MATRIX pair is uncovered: ${requirement}`, {
        requirement,
      }),
    );
};

const structuralGaps = (
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): readonly MatrixCoverageGap[] => {
  const actualIds = cells.map(({ cellId }) => cellId);
  const duplicateGaps = duplicateIds(actualIds).map((caseId) =>
    gap("duplicate-case", `duplicate emitted coverage case ${caseId}`, {
      caseId,
    }),
  );
  const expectedIds = matrix.cases.map(({ caseId }) => caseId);
  const orderMatches =
    stableSerialize(actualIds) === stableSerialize(expectedIds);
  return [
    ...duplicateGaps,
    ...(orderMatches
      ? []
      : [
          gap(
            "order-mismatch",
            "emitted coverage case order does not match frozen MATRIX",
          ),
        ]),
  ];
};

const rowGaps = (
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): readonly MatrixCoverageGap[] => {
  const expected = new Map(matrix.cases.map((entry) => [entry.caseId, entry]));
  const inapplicable = new Set(matrix.inapplicable.map(({ caseId }) => caseId));
  return cells.flatMap((cell) => {
    const matrixCase = expected.get(cell.cellId);
    if (matrixCase !== undefined)
      return coverageIdentityIssues(matrixCase, cell);
    if (inapplicable.has(cell.cellId))
      return [
        gap(
          "inapplicable-case",
          `${cell.cellId} is typed inapplicable in frozen MATRIX and cannot be emitted as coverage`,
          { caseId: cell.cellId },
        ),
      ];
    return [
      gap("extra-case", `unexpected emitted coverage case ${cell.cellId}`, {
        caseId: cell.cellId,
      }),
    ];
  });
};

const missingGaps = (
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): readonly MatrixCoverageGap[] => {
  const actualIds = new Set(cells.map(({ cellId }) => cellId));
  return matrix.cases.flatMap((matrixCase) => {
    if (actualIds.has(matrixCase.caseId)) return [];
    const isSpecialized = isSpecializedCoverageCase(matrixCase);
    return [
      gap(
        isSpecialized ? "missing-specialized-case" : "missing-case",
        `missing ${isSpecialized ? "specialized " : ""}coverage case ${matrixCase.caseId}`,
        { caseId: matrixCase.caseId },
      ),
      ...(cells.some((cell) => sameNominalCoverageWitness(matrixCase, cell))
        ? [
            gap(
              "fabricated-none-witness",
              `${matrixCase.caseId} is not covered by a nominal none witness`,
              { caseId: matrixCase.caseId },
            ),
          ]
        : []),
    ];
  });
};

const coveredCases = (
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): readonly MatrixExecutableCase[] =>
  matrix.cases.filter((matrixCase) => {
    const cell = cells.find(({ cellId }) => cellId === matrixCase.caseId);
    return (
      cell !== undefined &&
      coverageIdentityIssues(matrixCase, cell).length === 0
    );
  });

const collectCaseGaps = (
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): Readonly<{
  readonly gaps: readonly MatrixCoverageGap[];
  readonly coveredCases: readonly MatrixExecutableCase[];
}> => {
  return {
    gaps: [
      ...structuralGaps(matrix, cells),
      ...rowGaps(matrix, cells),
      ...missingGaps(matrix, cells),
    ],
    coveredCases: coveredCases(matrix, cells),
  };
};

export function verifyFrozenMatrixCoverage(
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): readonly MatrixCoverageGap[] {
  const { gaps, coveredCases } = collectCaseGaps(matrix, cells);
  return [...gaps, ...pairGaps(matrix, coveredCases)];
}

export const assertFrozenMatrixCoverage = (
  matrix: FrozenMatrix,
  cells: readonly CoverageCell[],
): void => {
  const gaps = verifyFrozenMatrixCoverage(matrix, cells);
  if (gaps.length > 0) throw new FrozenMatrixCoverageError(gaps);
};
