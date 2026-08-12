import { sha256Hex, stableId, stableSerialize } from "../support/ids.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import {
  DEFAULT_MAX_CASES,
  DEFAULT_MAX_CONTROLS,
  DESKTOP_HEIGHT,
  DESKTOP_WIDTH,
  executionFor,
  type FrozenMatrix,
  type MatrixExecutableCase,
  MatrixFinalizationError,
  type MatrixFinalizationInput,
  type MatrixInapplicableCase,
  type MatrixPreflightSegment,
  type MatrixPreparation,
  type MatrixRow,
  navigationExecution,
  stateForControl,
} from "./finalization/matrix-finalizer-contract.ts";
import {
  axisValue,
  freezeCampaignPreflight,
  pairKeys,
  parseFrozenMatrix,
} from "./finalization/matrix-finalizer-support.ts";
import { MATRIX_AXIS_NAMES } from "./matrix.ts";
import { executable, inapplicable } from "./matrix-finalizer-row-carrier.ts";

type MatrixIdentityFields = "sourceSha" | "sourceDigest" | "routes";

const preparationFor = (
  control: MatrixPreflightSegment["controls"][number],
): MatrixPreparation => ({
  revealPathDigest: control.revealPath.digest,
  expectedSurfaceDigest: control.expectedSurface.digest,
  expectedActionTransitionDigest:
    control.expectedActionTransition?.digest ?? null,
});

const uniqueByDigest = <T extends Readonly<{ readonly digest: string }>>(
  values: readonly T[],
): readonly T[] =>
  [
    ...new Map(values.map((value) => [value.digest, value] as const)).values(),
  ].toSorted((left, right) => left.digest.localeCompare(right.digest));

export * from "./finalization/matrix-finalizer-contract.ts";
export {
  freezeCampaignPreflight,
  parseFrozenMatrix,
  preflightNavigationStates,
  serializeFrozenMatrix,
} from "./finalization/matrix-finalizer-support.ts";
export { executable, inapplicable } from "./matrix-finalizer-row-carrier.ts";

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
  identity: Pick<MatrixFinalizationInput, MatrixIdentityFields>,
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
          { controlKey: control.controlKey, inventory: control.inventory },
          preparationFor(control),
        ),
      ];
    }),
    ...(segment.specialized ?? []).flatMap((entry) =>
      entry.execution === undefined
        ? []
        : [
            executable(
              identity,
              entry.state,
              entry.execution,
              {
                declarationId: entry.declarationId,
                ...(entry.resolverOutcome === undefined
                  ? {}
                  : { resolverOutcome: entry.resolverOutcome }),
                ...(entry.resolverRecoveryOutcome === undefined
                  ? {}
                  : { resolverRecoveryOutcome: entry.resolverRecoveryOutcome }),
              },
              undefined,
              entry.resolverOutcome,
            ),
          ],
    ),
  ]);

const inapplicableRowsFor = (
  identity: Pick<
    MatrixFinalizationInput,
    "sourceSha" | "sourceDigest" | "routes"
  >,
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
              { controlKey: control.controlKey, inventory: control.inventory },
              preparationFor(control),
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

const assertLimits = (
  maxCases: number,
  maxControlsPerSegment: number,
): void => {
  if (!Number.isInteger(maxCases) || maxCases < 1)
    throw new MatrixFinalizationError("Matrix maxCases must be positive");
  if (!Number.isInteger(maxControlsPerSegment) || maxControlsPerSegment < 1)
    throw new MatrixFinalizationError(
      "Matrix maxControlsPerSegment must be positive",
    );
};

const matrixIdentityFor = (
  input: Pick<MatrixFinalizationInput, "sourceSha" | "sourceDigest" | "routes">,
) => ({
  sourceSha: input.sourceSha,
  sourceDigest: input.sourceDigest,
  routes: input.routes,
});

export function finalizeCampaignMatrix(
  input: MatrixFinalizationInput,
): FrozenMatrix {
  const maxCases = input.maxCases ?? DEFAULT_MAX_CASES;
  const maxControlsPerSegment =
    input.maxControlsPerSegment ?? DEFAULT_MAX_CONTROLS;
  assertLimits(maxCases, maxControlsPerSegment);
  const segments = freezeCampaignPreflight({
    plan: input.plan,
    segments: input.preflight,
    maxControlsPerSegment,
  });
  const identity = matrixIdentityFor(input);
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
    revealPaths: uniqueByDigest(
      segments.flatMap(({ controls }) =>
        controls.map(({ revealPath }) => revealPath),
      ),
    ),
    revealSurfaces: uniqueByDigest(
      segments.flatMap(({ controls }) =>
        controls.flatMap(({ expectedSurface, expectedActionSurface }) => [
          expectedSurface,
          ...(expectedActionSurface === null ? [] : [expectedActionSurface]),
        ]),
      ),
    ),
    revealTransitions: uniqueByDigest(
      segments.flatMap(({ controls }) =>
        controls.flatMap(({ expectedActionTransition }) =>
          expectedActionTransition === null ? [] : [expectedActionTransition],
        ),
      ),
    ),
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
