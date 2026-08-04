import { type MatrixAxes, matrixAxesSchema } from "./contracts.ts";
import {
  assertSourceSha,
  makeStateId,
  sha256Hex,
  stableSerialize,
} from "./ids.ts";

// prettier-ignore
export const MATRIX_AXIS_NAMES = ["role", "route", "profileCapability", "lifecycle", "submission", "ownershipDensity", "permission", "fault", "controlTransition"] as const;
export type MatrixAxisName = (typeof MATRIX_AXIS_NAMES)[number];
export type AxisValues = {
  readonly [K in MatrixAxisName]: readonly MatrixAxes[K][];
};

// prettier-ignore
export interface MatrixConstraint { readonly id: string; readonly reason: string; readonly check: (axes: MatrixAxes) => boolean; }

// prettier-ignore
export interface PairwiseMatrixInput { readonly sourceSha: string; readonly generatorSeed: string; readonly axes: AxisValues; readonly constraints?: readonly MatrixConstraint[]; }

// prettier-ignore
export interface MatrixInapplicable { readonly axes: MatrixAxes; readonly constraintId: string; readonly reason: string; }

// prettier-ignore
export interface PairwiseState { readonly stateId: string; readonly axes: MatrixAxes; readonly pairwiseDigest: string; }

// prettier-ignore
export interface PairwiseMatrix { readonly states: readonly PairwiseState[]; readonly inapplicable: readonly MatrixInapplicable[]; readonly coveredPairs: readonly string[]; readonly digest: string; }

type PartialAxes = Partial<MatrixAxes>;
interface Stage {
  readonly rows: readonly PartialAxes[];
  readonly inapplicable: readonly MatrixInapplicable[];
}

export class MatrixCompileError extends Error {
  override readonly name = "MatrixCompileError";
}

// prettier-ignore
function readAxis<K extends MatrixAxisName>(row: PartialAxes, axis: K): MatrixAxes[K] { const value = row[axis]; if (value === undefined) { throw new MatrixCompileError(`Missing axis: ${axis}`); } return value; }
// prettier-ignore
function withAxis<K extends MatrixAxisName>(row: PartialAxes, axis: K, value: MatrixAxes[K]): PartialAxes { return { ...row, [axis]: value }; }

function completeAxes(row: PartialAxes): MatrixAxes | undefined {
  const parsed = matrixAxesSchema.safeParse(row);
  return parsed.success ? parsed.data : undefined;
}

function pairKeys(
  row: PartialAxes,
  axes: readonly MatrixAxisName[],
): readonly string[] {
  return axes.flatMap((left, index) =>
    axes
      .slice(index + 1)
      .map(
        (right) =>
          `${left}=${readAxis(row, left)}|${right}=${readAxis(row, right)}`,
      ),
  );
}

// prettier-ignore
function uniqueRows(rows: readonly PartialAxes[]): readonly PartialAxes[] { return rows.filter((row, index, all) => all.findIndex((candidate) => stableSerialize(candidate) === stableSerialize(row)) === index); }

function greedyRows(
  candidates: readonly PartialAxes[],
  axes: readonly MatrixAxisName[],
  selected: readonly PartialAxes[],
  remaining: ReadonlySet<string>,
): readonly PartialAxes[] {
  if (remaining.size === 0) return selected;
  const selectedKeys = new Set(selected.map(stableSerialize));
  const ranked = candidates
    .filter((row) => !selectedKeys.has(stableSerialize(row)))
    .map((row) => ({
      row,
      score: pairKeys(row, axes).filter((pair) => remaining.has(pair)).length,
    }))
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        stableSerialize(left.row).localeCompare(stableSerialize(right.row)),
    );
  const best = ranked.at(0);
  if (best === undefined || best.score === 0) return selected;
  const nextRemaining = new Set(
    [...remaining].filter((pair) => !pairKeys(best.row, axes).includes(pair)),
  );
  return greedyRows(candidates, axes, [...selected, best.row], nextRemaining);
}

function selectRows(
  candidates: readonly PartialAxes[],
  axes: readonly MatrixAxisName[],
  newAxis: MatrixAxisName,
  values: readonly string[],
): readonly PartialAxes[] {
  const unique = uniqueRows(candidates);
  const seeds = values.flatMap((value) =>
    unique.filter((row) => readAxis(row, newAxis) === value).slice(0, 1),
  );
  const required = new Set(unique.flatMap((row) => pairKeys(row, axes)));
  const covered = new Set(seeds.flatMap((row) => pairKeys(row, axes)));
  const remaining = new Set([...required].filter((pair) => !covered.has(pair)));
  return greedyRows(unique, axes, seeds, remaining);
}

function violation(
  row: PartialAxes,
  constraints: readonly MatrixConstraint[],
): MatrixInapplicable | undefined {
  const axes = completeAxes(row);
  if (axes === undefined) return undefined;
  const failed = constraints.find((constraint) => !constraint.check(axes));
  return failed === undefined
    ? undefined
    : { axes, constraintId: failed.id, reason: failed.reason };
}

function buildStage(
  stage: Stage,
  axis: MatrixAxisName,
  values: readonly string[],
  activeAxes: readonly MatrixAxisName[],
  final: boolean,
  constraints: readonly MatrixConstraint[],
): Stage {
  const expanded = stage.rows.flatMap((row) =>
    values.map((value) => withAxis(row, axis, value)),
  );
  const inapplicable = expanded
    .map((row) => violation(row, constraints))
    .filter((entry): entry is MatrixInapplicable => entry !== undefined);
  const applicable = final
    ? expanded.filter((row) => violation(row, constraints) === undefined)
    : expanded;
  return {
    rows: selectRows(applicable, activeAxes, axis, values),
    inapplicable: [...stage.inapplicable, ...inapplicable],
  };
}

function statesFrom(
  rows: readonly PartialAxes[],
  input: PairwiseMatrixInput,
): readonly PairwiseState[] {
  return rows.flatMap((row) => {
    const axes = completeAxes(row);
    return axes === undefined
      ? []
      : [
          {
            stateId: makeStateId(input.sourceSha, input.generatorSeed, axes),
            axes,
            pairwiseDigest: sha256Hex(axes),
          },
        ];
  });
}

export function compilePairwiseMatrix(
  input: PairwiseMatrixInput,
): PairwiseMatrix {
  assertSourceSha(input.sourceSha);
  const invalidAxis = MATRIX_AXIS_NAMES.find(
    (axis) =>
      input.axes[axis].length === 0 ||
      new Set(input.axes[axis]).size !== input.axes[axis].length,
  );
  if (invalidAxis !== undefined)
    throw new MatrixCompileError(`Axis ${invalidAxis} must have unique values`);
  const constraints = input.constraints ?? [];
  const firstAxis = MATRIX_AXIS_NAMES[0];
  const initial: Stage = {
    rows: input.axes[firstAxis].map((value) => withAxis({}, firstAxis, value)),
    inapplicable: [],
  };
  const finalStage = MATRIX_AXIS_NAMES.slice(1).reduce(
    (stage, axis, index, axes) =>
      buildStage(
        stage,
        axis,
        input.axes[axis],
        MATRIX_AXIS_NAMES.slice(0, index + 2),
        index === axes.length - 1,
        constraints,
      ),
    initial,
  );
  const states = statesFrom(finalStage.rows, input);
  if (states.length === 0)
    throw new MatrixCompileError("No applicable matrix states");
  const coveredPairs = [
    ...new Set(
      states.flatMap((state) => pairKeys(state.axes, MATRIX_AXIS_NAMES)),
    ),
  ].toSorted((left, right) => left.localeCompare(right));
  return {
    states,
    inapplicable: finalStage.inapplicable,
    coveredPairs,
    digest: sha256Hex({
      sourceSha: input.sourceSha,
      generatorSeed: input.generatorSeed,
      axes: input.axes,
      constraints: constraints.map(({ id, reason }) => ({ id, reason })),
      states,
      inapplicable: finalStage.inapplicable,
    }),
  };
}
