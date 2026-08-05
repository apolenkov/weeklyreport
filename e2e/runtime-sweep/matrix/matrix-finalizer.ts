import { sha256Hex, stableId, stableSerialize } from "../support/ids.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import { MATRIX_AXIS_NAMES } from "./matrix.ts";
import {
  DEFAULT_MAX_CASES,
  DEFAULT_MAX_CONTROLS,
  DESKTOP_HEIGHT,
  DESKTOP_WIDTH,
  executable,
  executionFor,
  type FrozenMatrix,
  inapplicable,
  type MatrixExecutableCase,
  MatrixFinalizationError,
  type MatrixFinalizationInput,
  type MatrixInapplicableCase,
  type MatrixPreflightSegment,
  type MatrixRow,
  navigationExecution,
  stateForControl,
} from "./matrix-finalizer-contract.ts";
import {
  axisValue,
  freezeCampaignPreflight,
  pairKeys,
  parseFrozenMatrix,
} from "./matrix-finalizer-support.ts";

export * from "./matrix-finalizer-contract.ts";
export {
  freezeCampaignPreflight,
  parseFrozenMatrix,
  preflightNavigationStates,
  serializeFrozenMatrix,
} from "./matrix-finalizer-support.ts";

const omissionState = (
  input: MatrixFinalizationInput,
  axis: (typeof MATRIX_AXIS_NAMES)[number],
  value: string,
  profile = input.plan.states[0]?.profile,
): CampaignMatrixState => {
  const base = input.plan.states.at(0);
  if (base === undefined || profile === undefined) {
    throw new MatrixFinalizationError("Matrix plan has no states");
  }
  const axes =
    axis === "route"
      ? {
          ...base.axes,
          ...(value.includes(":")
            ? {
                role: value.slice(
                  0,
                  value.indexOf(":"),
                ) as typeof base.axes.role,
              }
            : {}),
          route: value,
        }
      : { ...base.axes, [axis]: value };
  return {
    profile,
    axes,
    stateId: stableId("matrix-omission-state", {
      sourceSha: input.sourceSha,
      axis,
      value,
      profile,
    }),
    pairwiseDigest: sha256Hex(axes),
  };
};

const planInapplicableState = (
  input: MatrixFinalizationInput,
  entry: CampaignMatrixPlan["inapplicable"][number],
): CampaignMatrixState => ({
  profile: entry.profile,
  axes: entry.axes,
  stateId: stableId("matrix-plan-inapplicable-state", {
    sourceSha: input.sourceSha,
    profile: entry.profile,
    axes: entry.axes,
  }),
  pairwiseDigest: sha256Hex(entry.axes),
});

const omittedRows = (
  input: MatrixFinalizationInput,
  cases: readonly MatrixExecutableCase[],
): readonly MatrixInapplicableCase[] =>
  MATRIX_AXIS_NAMES.flatMap((axis) =>
    input.declaration.axes[axis]
      .filter((value) => !cases.some((row) => axisValue(row, axis) === value))
      .map((value) =>
        inapplicable(input, omissionState(input, axis, value), {
          constraintId: "axis-value-not-preflighted",
          reason: `Declared ${axis} value ${value} has no executable preflight row`,
        }),
      ),
  );

const planRows = (
  input: MatrixFinalizationInput,
): readonly MatrixInapplicableCase[] =>
  input.plan.inapplicable.map((entry) =>
    inapplicable(input, planInapplicableState(input, entry), {
      constraintId: entry.constraintId,
      reason: entry.reason,
    }),
  );

const rowsFor = (
  identity: Pick<MatrixFinalizationInput, "sourceSha" | "routes">,
  segments: readonly MatrixPreflightSegment[],
): readonly MatrixExecutableCase[] =>
  segments.flatMap((segment) => [
    executable(identity, segment.state, navigationExecution(segment.state)),
    ...segment.controls.flatMap((control) => {
      if (control.inapplicable !== undefined) return [];
      const execution = executionFor(control);
      return [
        executable(
          identity,
          stateForControl(segment.state, execution),
          execution,
          control.inventory,
        ),
      ];
    }),
    ...(segment.specialized ?? []).flatMap((entry) =>
      entry.execution === undefined
        ? []
        : [
            executable(identity, entry.state, entry.execution, {
              declarationId: entry.declarationId,
            }),
          ],
    ),
  ]);

const inapplicableRowsFor = (
  identity: Pick<MatrixFinalizationInput, "sourceSha" | "routes">,
  input: MatrixFinalizationInput,
  segments: readonly MatrixPreflightSegment[],
  cases: readonly MatrixExecutableCase[],
): readonly MatrixInapplicableCase[] => [
  ...segments.flatMap((segment) =>
    segment.controls.flatMap((control) =>
      control.inapplicable === undefined
        ? []
        : [
            inapplicable(
              identity,
              segment.state,
              control.inapplicable,
              control.inventory,
            ),
          ],
    ),
  ),
  ...segments.flatMap((segment) =>
    (segment.specialized ?? []).flatMap((entry) =>
      entry.inapplicable === undefined
        ? []
        : [
            inapplicable(identity, entry.state, entry.inapplicable, {
              declarationId: entry.declarationId,
            }),
          ],
    ),
  ),
  ...planRows(input),
  ...omittedRows(input, cases),
];

const ordered = <T>(rows: readonly T[]): readonly T[] =>
  rows.toSorted((left, right) =>
    stableSerialize(left).localeCompare(stableSerialize(right)),
  );

export function finalizeCampaignMatrix(
  input: MatrixFinalizationInput,
): FrozenMatrix {
  const maxCases = input.maxCases ?? DEFAULT_MAX_CASES;
  const maxControlsPerSegment =
    input.maxControlsPerSegment ?? DEFAULT_MAX_CONTROLS;
  if (!Number.isInteger(maxCases) || maxCases < 1) {
    throw new MatrixFinalizationError("Matrix maxCases must be positive");
  }
  if (!Number.isInteger(maxControlsPerSegment) || maxControlsPerSegment < 1) {
    throw new MatrixFinalizationError(
      "Matrix maxControlsPerSegment must be positive",
    );
  }
  const segments = freezeCampaignPreflight({
    plan: input.plan,
    segments: input.preflight,
    maxControlsPerSegment,
  });
  const identity = { sourceSha: input.sourceSha, routes: input.routes };
  const cases = ordered(rowsFor(identity, segments));
  const inapplicable = ordered(
    inapplicableRowsFor(identity, input, segments, cases),
  );
  const rows: readonly MatrixRow[] = [...cases, ...inapplicable];
  if (rows.length > maxCases) {
    throw new MatrixFinalizationError(
      `Matrix has ${rows.length} finalized cases; max is ${maxCases}`,
    );
  }
  const body = {
    version: 1 as const,
    sourceSha: input.sourceSha,
    viewport: {
      browser: "chromium" as const,
      width: DESKTOP_WIDTH,
      height: DESKTOP_HEIGHT,
    },
    generatorSeed: input.declaration.generatorSeed,
    rows,
    cases,
    inapplicable,
    coveredPairs: [...new Set(cases.flatMap(pairKeys))].toSorted((a, b) =>
      a.localeCompare(b),
    ),
    counts: {
      executable: cases.length,
      inapplicable: inapplicable.length,
      total: rows.length,
    },
    limits: { maxCases, maxControlsPerSegment },
  } satisfies Omit<FrozenMatrix, "digest">;
  return parseFrozenMatrix({ ...body, digest: sha256Hex(body) });
}
