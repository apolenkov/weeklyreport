import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "./campaign-matrix.ts";
import { sha256Hex, stableSerialize } from "./ids.ts";
import { freezeDeep } from "./manifest-source.ts";
import { MATRIX_AXIS_NAMES } from "./matrix.ts";
import {
  DEFAULT_MAX_CONTROLS,
  type FrozenMatrix,
  frozenMatrixSchema,
  type MatrixExecutableCase,
  MatrixFinalizationError,
  type MatrixInapplicableCase,
  type MatrixPreflightSegment,
} from "./matrix-finalizer-contract.ts";

const assertInvariant = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new MatrixFinalizationError(message);
  }
};

const preflightMap = (
  segments: readonly MatrixPreflightSegment[],
): ReadonlyMap<string, MatrixPreflightSegment> => {
  const entries = segments.map(
    (segment) => [segment.state.stateId, segment] as const,
  );
  assertInvariant(
    new Set(entries.map(([stateId]) => stateId)).size === entries.length,
    "Preflight contains duplicate state ids",
  );
  return new Map(entries);
};

export const preflightNavigationStates = (
  plan: CampaignMatrixPlan,
): readonly MatrixPreflightSegment[] =>
  plan.states.map((state) => ({ state, controls: [], specialized: [] }));

const validateSegment = (
  limit: number,
  segment: MatrixPreflightSegment,
): void => {
  const { state, controls, specialized = [] } = segment;
  assertInvariant(
    controls.length <= limit,
    `Preflight has too many controls for ${state.stateId}; max is ${limit}`,
  );
  assertInvariant(
    new Set(controls.map(({ controlKey }) => controlKey)).size ===
      controls.length,
    `Preflight contains duplicate controls for ${state.stateId}`,
  );
  controls.forEach((control) => {
    const outcomes = [
      control.action,
      control.execution,
      control.inapplicable,
    ].filter((value) => value !== undefined);
    assertInvariant(
      outcomes.length === 1,
      `Control ${control.controlKey} must declare exactly one bounded outcome`,
    );
    assertInvariant(
      control.action === undefined ||
        control.action.controlKey === control.controlKey,
      `Control ${control.controlKey} action identity does not match the frozen inventory`,
    );
  });
  specialized.forEach(
    ({ state: specializedState, execution, inapplicable: reason }) =>
      assertInvariant(
        (execution === undefined) !== (reason === undefined),
        `Specialized state ${specializedState.stateId} must declare exactly one bounded outcome`,
      ),
  );
};

const expectedState = (
  plan: CampaignMatrixPlan,
  state: CampaignMatrixState,
): CampaignMatrixState | undefined =>
  plan.states.find(({ stateId }) => stateId === state.stateId);

export function freezeCampaignPreflight(input: {
  readonly plan: CampaignMatrixPlan;
  readonly segments: readonly MatrixPreflightSegment[];
  readonly maxControlsPerSegment?: number;
}): readonly MatrixPreflightSegment[] {
  const known = preflightMap(input.segments);
  const missing = input.plan.states.find(({ stateId }) => !known.has(stateId));
  assertInvariant(
    missing === undefined,
    missing === undefined
      ? ""
      : `Preflight is missing state ${missing.stateId}`,
  );
  const extra = input.segments.find(
    ({ state }) => expectedState(input.plan, state) === undefined,
  );
  assertInvariant(
    extra === undefined,
    extra === undefined
      ? ""
      : `Preflight contains unknown state ${extra.state.stateId}`,
  );
  input.segments.forEach(({ state }) => {
    const expected = expectedState(input.plan, state);
    assertInvariant(
      expected === undefined ||
        stableSerialize({ profile: expected.profile, axes: expected.axes }) ===
          stableSerialize({ profile: state.profile, axes: state.axes }),
      `Preflight state payload changed for ${state.stateId}`,
    );
  });
  const limit = input.maxControlsPerSegment ?? DEFAULT_MAX_CONTROLS;
  assertInvariant(
    Number.isInteger(limit) && limit >= 1,
    "Matrix maxControlsPerSegment must be positive",
  );
  input.segments.forEach((segment) => validateSegment(limit, segment));
  return freezeDeep(
    input.segments
      .map((segment) => ({
        ...segment,
        controls: segment.controls.toSorted((a, b) =>
          a.controlKey.localeCompare(b.controlKey),
        ),
        specialized: [...(segment.specialized ?? [])].toSorted((a, b) =>
          a.state.stateId.localeCompare(b.state.stateId),
        ),
      }))
      .toSorted((a, b) => a.state.stateId.localeCompare(b.state.stateId)),
  );
}

export const axisValue = (
  row: MatrixExecutableCase,
  axis: (typeof MATRIX_AXIS_NAMES)[number],
): string =>
  axis === "role"
    ? row.role
    : axis === "route"
      ? `${row.role}:${row.catalogRoute}`
      : row.state[axis];

export const pairKeys = (row: MatrixExecutableCase): readonly string[] =>
  MATRIX_AXIS_NAMES.flatMap((left, index) =>
    MATRIX_AXIS_NAMES.slice(index + 1).map(
      (right) =>
        `${left}=${axisValue(row, left)}|${right}=${axisValue(row, right)}`,
    ),
  );

const digestFor = (matrix: Omit<FrozenMatrix, "digest">): string =>
  sha256Hex(matrix);

const assertMatrixConsistency = (matrix: FrozenMatrix): void => {
  const executableRows = matrix.rows.filter(
    (row): row is MatrixExecutableCase => row.kind === "executable",
  );
  const inapplicableRows = matrix.rows.filter(
    (row): row is MatrixInapplicableCase => row.kind === "inapplicable",
  );
  const pairs = [...new Set(matrix.cases.flatMap(pairKeys))].toSorted((a, b) =>
    a.localeCompare(b),
  );
  assertInvariant(
    stableSerialize(executableRows) === stableSerialize(matrix.cases) &&
      stableSerialize(inapplicableRows) ===
        stableSerialize(matrix.inapplicable),
    "Frozen MATRIX.json rows do not partition cases and inapplicable records",
  );
  assertInvariant(
    new Set(matrix.rows.map(({ caseId }) => caseId)).size ===
      matrix.rows.length,
    "Frozen MATRIX.json contains duplicate case ids",
  );
  assertInvariant(
    matrix.counts.executable === matrix.cases.length &&
      matrix.counts.inapplicable === matrix.inapplicable.length &&
      matrix.counts.total === matrix.rows.length,
    "Frozen MATRIX.json counts are not derived from rows",
  );
  assertInvariant(
    stableSerialize(pairs) === stableSerialize(matrix.coveredPairs),
    "Frozen MATRIX.json pair coverage is not derived from executable rows",
  );
};

export function parseFrozenMatrix(value: unknown): FrozenMatrix {
  const matrix = frozenMatrixSchema.parse(value);
  assertMatrixConsistency(matrix);
  const { digest: _digest, ...body } = matrix;
  assertInvariant(
    digestFor(body) === matrix.digest,
    "Frozen MATRIX.json digest does not match its contents",
  );
  assertInvariant(
    matrix.counts.total <= matrix.limits.maxCases,
    "Frozen MATRIX.json exceeds its declared total-case limit",
  );
  return freezeDeep(matrix);
}

export const serializeFrozenMatrix = (matrix: FrozenMatrix): string =>
  `${stableSerialize(parseFrozenMatrix(matrix))}\n`;
