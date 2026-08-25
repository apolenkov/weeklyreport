import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import {
  parseRevealTransition,
  type RevealTransition,
} from "../../../matrix/reveal-transition.ts";
import type { RuntimeMatrixSource } from "../../../matrix/runtime-matrix.ts";
import {
  canonicalRevealUrlFor,
  type RevealSurface,
  revealSurfaceFor,
} from "../../../preflight/reveal-path.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { DomInventory } from "../../dom/dom-inventory.ts";

type TransitionBoundary = Readonly<{
  inventory: DomInventory;
  url: string;
}>;

type TransitionValidationInput = Readonly<{
  source: RuntimeMatrixSource;
  matrixCase: MatrixExecutableCase;
  before: TransitionBoundary;
  after: TransitionBoundary;
}>;

export type FrozenActionTransition = Readonly<{
  transition: RevealTransition;
  before: RevealSurface;
  after: RevealSurface;
}>;

const uniqueTransitionFor = (
  source: RuntimeMatrixSource,
  digest: string,
): FrozenActionTransition => {
  const match = source.revealTransitionsByDigest.get(digest);
  if (match === undefined)
    throw new Error(
      `Frozen action transition ${digest} must resolve exactly once`,
    );
  const transition = parseRevealTransition(match);
  const before = source.revealSurfacesByDigest.get(
    transition.beforeSurfaceDigest,
  );
  const after = source.revealSurfacesByDigest.get(
    transition.afterSurfaceDigest,
  );
  if (before === undefined || after === undefined)
    throw new Error(
      `Frozen action transition ${digest} has an unresolved surface`,
    );
  return { transition, before, after };
};

export const resolveFrozenActionTransition = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
): FrozenActionTransition | undefined => {
  const digest = matrixCase.preparation?.expectedActionTransitionDigest;
  return digest === undefined || digest === null
    ? undefined
    : uniqueTransitionFor(source, digest);
};

const surfaceIssues = (
  phase: "before" | "after",
  expected: RevealSurface,
  inventory: DomInventory,
): readonly string[] => {
  const actual = revealSurfaceFor(inventory.controls);
  if (actual.digest === expected.digest) return [];
  const expectedByKey = new Map(
    expected.controls.map((control) => [control.controlKey, control] as const),
  );
  const actualByKey = new Map(
    actual.controls.map((control) => [control.controlKey, control] as const),
  );
  const unknown = actual.controls
    .filter(({ controlKey }) => !expectedByKey.has(controlKey))
    .map(({ controlKey }) => controlKey);
  const missing = expected.controls
    .filter(({ controlKey }) => !actualByKey.has(controlKey))
    .map(({ controlKey }) => controlKey);
  const changed = expected.controls
    .filter(({ controlKey }) => actualByKey.has(controlKey))
    .filter(
      (control) =>
        stableSerialize(control) !==
        stableSerialize(actualByKey.get(control.controlKey)),
    )
    .map(({ controlKey }) => controlKey);
  return [
    `frozen ${phase} action surface drift: expected=${expected.digest} actual=${actual.digest}`,
    ...(unknown.length === 0
      ? []
      : [
          `frozen ${phase} action surface has unknown controls: ${unknown.join(", ")}`,
        ]),
    ...(missing.length === 0
      ? []
      : [
          `frozen ${phase} action surface is missing controls: ${missing.join(", ")}`,
        ]),
    ...(changed.length === 0
      ? []
      : [
          `frozen ${phase} action surface has signature drift: ${changed.join(", ")}`,
        ]),
  ];
};

const urlIssues = (
  phase: "before" | "after",
  expected: string,
  actual: string,
): readonly string[] => {
  const canonical = canonicalRevealUrlFor(actual);
  return canonical === expected
    ? []
    : [
        `frozen ${phase} action URL drift: expected=${expected} actual=${canonical}`,
      ];
};

export const frozenActionBeforeIssues = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  boundary: TransitionBoundary,
): readonly string[] => {
  const transition = resolveFrozenActionTransition(source, matrixCase);
  if (transition === undefined) return [];
  return [
    ...surfaceIssues("before", transition.before, boundary.inventory),
    ...urlIssues("before", transition.transition.beforeUrl, boundary.url),
  ];
};

export const frozenActionTransitionIssues = (
  input: TransitionValidationInput,
): readonly string[] => {
  const transition = resolveFrozenActionTransition(
    input.source,
    input.matrixCase,
  );
  if (transition === undefined) return [];
  return [
    ...surfaceIssues("before", transition.before, input.before.inventory),
    ...urlIssues("before", transition.transition.beforeUrl, input.before.url),
    ...surfaceIssues("after", transition.after, input.after.inventory),
    ...urlIssues("after", transition.transition.afterUrl, input.after.url),
  ];
};
