import {
  assertRevealPath,
  parseRevealPath,
  parseRevealSurface,
} from "../../preflight/reveal-path.ts";
import { stableSerialize } from "../../support/ids.ts";
import { actionRequiresFrozenTransition } from "../policy/matrix-preflight-transition-validation.ts";
import {
  parseRevealTransition,
  type RevealTransition,
} from "../reveal-transition.ts";
import {
  type FrozenMatrix,
  MatrixFinalizationError,
} from "./matrix-finalizer-contract.ts";

const assertInvariant = (condition: boolean, message: string): void => {
  if (!condition) throw new MatrixFinalizationError(message);
};

type RevealRegistry = Readonly<{
  readonly paths: ReadonlyMap<string, ReturnType<typeof parseRevealPath>>;
  readonly surfaces: ReadonlyMap<string, ReturnType<typeof parseRevealSurface>>;
  readonly transitions: ReadonlyMap<string, RevealTransition>;
  readonly surfaceKeys: ReadonlyMap<string, ReadonlySet<string>>;
}>;

const revealRegistryFor = (matrix: FrozenMatrix): RevealRegistry => {
  const paths = new Map(
    matrix.revealPaths.map((path) => [path.digest, parseRevealPath(path)]),
  );
  const surfaces = new Map(
    matrix.revealSurfaces.map((surface) => [
      surface.digest,
      parseRevealSurface(surface),
    ]),
  );
  const transitions = new Map(
    matrix.revealTransitions.map((transition) => [
      transition.digest,
      parseRevealTransition(transition),
    ]),
  );
  const surfaceKeys = new Map(
    [...surfaces.entries()].map(
      ([digest, surface]) =>
        [
          digest,
          new Set(surface.controls.map(({ controlKey }) => controlKey)),
        ] as const,
    ),
  );
  assertInvariant(
    paths.size === matrix.revealPaths.length,
    "Frozen MATRIX.json contains duplicate reveal paths",
  );
  assertInvariant(
    surfaces.size === matrix.revealSurfaces.length,
    "Frozen MATRIX.json contains duplicate reveal surfaces",
  );
  assertInvariant(
    transitions.size === matrix.revealTransitions.length,
    "Frozen MATRIX.json contains duplicate reveal transitions",
  );
  return { paths, surfaces, transitions, surfaceKeys };
};

const assertExpectedTransition = (
  row: FrozenMatrix["rows"][number],
  registry: RevealRegistry,
): void => {
  const digest = row.preparation?.expectedActionTransitionDigest;
  const action =
    row.kind === "executable" && "action" in row.execution
      ? row.execution.action
      : undefined;
  const expectedSurface =
    row.preparation === undefined
      ? undefined
      : registry.surfaces.get(row.preparation.expectedSurfaceDigest);
  assertInvariant(
    !actionRequiresFrozenTransition(action, expectedSurface) ||
      (digest !== undefined && digest !== null),
    "Frozen MATRIX.json reveal action requires an exact action transition",
  );
  if (digest === undefined || digest === null) return;
  const transition = registry.transitions.get(digest);
  assertInvariant(
    transition !== undefined,
    "Frozen MATRIX.json action transition reference is unresolved",
  );
  if (transition === undefined || row.preparation === undefined) return;
  assertInvariant(
    transition.beforeSurfaceDigest === row.preparation.expectedSurfaceDigest,
    "Frozen MATRIX.json action transition has the wrong before surface",
  );
  assertInvariant(
    registry.surfaces.has(transition.afterSurfaceDigest),
    "Frozen MATRIX.json action transition after surface is unresolved",
  );
  assertInvariant(
    registry.surfaces.has(transition.beforeSurfaceDigest),
    "Frozen MATRIX.json action transition before surface is unresolved",
  );
  assertInvariant(
    action !== undefined,
    "Frozen MATRIX.json action transition requires an executable action",
  );
  if (action === undefined) return;
  assertInvariant(
    stableSerialize(transition.action) === stableSerialize(action),
    "Frozen MATRIX.json action transition does not match its execution",
  );
};

const assertResolvedPreparation = (
  row: FrozenMatrix["rows"][number],
  registry: RevealRegistry,
): void => {
  if (row.controlKey === undefined || row.preparation === undefined) return;
  const path = registry.paths.get(row.preparation.revealPathDigest);
  const surface = registry.surfaces.get(row.preparation.expectedSurfaceDigest);
  assertInvariant(
    path !== undefined && surface !== undefined,
    "Frozen MATRIX.json preparation references are unresolved",
  );
  if (path === undefined || surface === undefined) return;
  try {
    const keys = registry.surfaceKeys.get(surface.digest);
    if (!keys?.has(row.controlKey))
      throw new Error(
        `Reveal surface does not contain target control ${row.controlKey}`,
      );
  } catch (error: unknown) {
    throw new MatrixFinalizationError(
      `Frozen MATRIX.json reveal preparation is invalid: ${
        error instanceof Error ? error.message : "invalid preparation"
      }`,
    );
  }
};

const assertRevealPreparationPaths = (
  matrix: FrozenMatrix,
  registry: RevealRegistry,
): void => {
  const preparations = new Map(
    matrix.rows.flatMap((row) =>
      row.preparation === undefined
        ? []
        : [
            [
              `${row.preparation.revealPathDigest}:${row.preparation.expectedSurfaceDigest}`,
              row.preparation,
            ] as const,
          ],
    ),
  );
  preparations.forEach(({ revealPathDigest, expectedSurfaceDigest }) => {
    const path = registry.paths.get(revealPathDigest);
    const surface = registry.surfaces.get(expectedSurfaceDigest);
    assertInvariant(
      path !== undefined && surface !== undefined,
      "Frozen MATRIX.json preparation references are unresolved",
    );
    if (path === undefined || surface === undefined) return;
    try {
      assertRevealPath(path, surface);
    } catch (error: unknown) {
      throw new MatrixFinalizationError(
        `Frozen MATRIX.json reveal preparation is invalid: ${
          error instanceof Error ? error.message : "invalid preparation"
        }`,
      );
    }
  });
};

const assertRowProvenance = (
  row: FrozenMatrix["rows"][number],
  registry: RevealRegistry,
): void => {
  const hasControl = row.controlKey !== undefined;
  const hasPreparation = row.preparation !== undefined;
  if (row.declarationId !== undefined)
    assertInvariant(
      !hasControl && !hasPreparation,
      "Specialized MATRIX rows cannot carry control preparation",
    );
  assertInvariant(
    hasControl === hasPreparation,
    "Frozen MATRIX.json control provenance must carry reveal preparation",
  );
  assertResolvedPreparation(row, registry);
  assertExpectedTransition(row, registry);
  if (row.kind !== "executable") return;
  const navigationLike =
    row.execution.kind === "navigation" || row.execution.kind === "idle";
  if (navigationLike)
    assertInvariant(
      !hasControl && !hasPreparation,
      "Navigation and idle rows cannot carry reveal preparation",
    );
  if (row.execution.kind === "control")
    assertInvariant(
      hasControl && hasPreparation,
      "Executable control rows require reveal preparation",
    );
  if (hasControl && "action" in row.execution)
    assertInvariant(
      row.execution.action.controlKey === row.controlKey,
      "Matrix control provenance does not match execution action",
    );
};

export const assertMatrixRevealConsistency = (matrix: FrozenMatrix): void => {
  const registry = revealRegistryFor(matrix);
  matrix.rows.forEach((row) => {
    assertRowProvenance(row, registry);
  });
  assertRevealPreparationPaths(matrix, registry);
};
