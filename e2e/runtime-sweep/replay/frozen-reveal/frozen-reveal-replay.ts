import type { Page } from "@playwright/test";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import type { RuntimeMatrixSource } from "../../matrix/runtime-matrix.ts";
import {
  assertRevealPathForControl,
  canonicalRevealUrlFor,
  parseRevealPath,
  parseRevealSurface,
  type RevealNonMutationProof,
  type RevealPath,
  type RevealStep,
  type RevealSurface,
  type RevealSurfaceControl,
  revealSurfaceFor,
} from "../../preflight/reveal-path.ts";
import type { Action } from "../../source/contracts.ts";
import type { DomInventory } from "../dom/dom-inventory.ts";
import { FrozenRevealReplayError } from "./frozen-reveal-replay-error.ts";
import { assertFrozenRevealTarget } from "./frozen-reveal-target.ts";

export type FrozenRevealPreparation = Readonly<{
  readonly path: RevealPath;
  readonly surface: RevealSurface;
}>;

export type FrozenRevealReplayResult = Readonly<{
  readonly actionCount: number;
  readonly finalUrl: string;
  readonly finalSurfaceDigest: string;
}>;

type FrozenRevealActionResult = void | Readonly<{
  readonly status: "pass" | "fail" | "ambiguous" | "not-exercised";
}>;

export interface FrozenRevealReplayInput {
  readonly page: Page;
  readonly preparation: FrozenRevealPreparation;
  readonly inventory: (page: Page) => Promise<DomInventory>;
  readonly execute: (
    page: Page,
    action: RevealStep,
    control: RevealSurfaceControl,
  ) => Promise<FrozenRevealActionResult>;
  readonly proveNonMutation: (
    action: () => Promise<void>,
  ) => Promise<RevealNonMutationProof>;
  readonly settle?: () => Promise<void>;
  readonly cleanup: () => void | Promise<void>;
}

type RevealRegistry = Readonly<{
  readonly paths: ReadonlyMap<string, RevealPath>;
  readonly surfaces: ReadonlyMap<string, RevealSurface>;
}>;

const registryFor = <T extends Readonly<{ readonly digest: string }>>(
  values: readonly T[],
  parse: (value: T) => T,
  label: string,
): ReadonlyMap<string, T> => {
  const entries = values.map((value) => [value.digest, parse(value)] as const);
  if (new Set(entries.map(([digest]) => digest)).size !== entries.length)
    throw new FrozenRevealReplayError(
      `MATRIX.json contains duplicate ${label}`,
    );
  return new Map(entries);
};

const revealRegistryFor = (source: RuntimeMatrixSource): RevealRegistry => ({
  paths: registryFor(
    source.matrix.revealPaths,
    parseRevealPath,
    "reveal paths",
  ),
  surfaces: registryFor(
    source.matrix.revealSurfaces,
    parseRevealSurface,
    "reveal surfaces",
  ),
});

const controlKeyFor = (matrixCase: MatrixExecutableCase): string | undefined =>
  matrixCase.controlKey ??
  ("action" in matrixCase.execution
    ? matrixCase.execution.action.controlKey
    : undefined);

export const resolveFrozenRevealPreparation = (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
): FrozenRevealPreparation | undefined => {
  const reference = matrixCase.preparation;
  if (reference === undefined) return undefined;
  const controlKey = controlKeyFor(matrixCase);
  if (controlKey === undefined)
    throw new FrozenRevealReplayError(
      `Frozen case ${matrixCase.caseId} has preparation without a control key`,
    );
  const registry = revealRegistryFor(source);
  const path = registry.paths.get(reference.revealPathDigest);
  const surface = registry.surfaces.get(reference.expectedSurfaceDigest);
  if (path === undefined || surface === undefined)
    throw new FrozenRevealReplayError(
      `Frozen case ${matrixCase.caseId} has unresolved reveal preparation`,
    );
  try {
    assertRevealPathForControl(path, surface, controlKey);
  } catch (error: unknown) {
    throw new FrozenRevealReplayError(
      `Frozen case ${matrixCase.caseId} has invalid reveal preparation: ${
        error instanceof Error ? error.message : "invalid preparation"
      }`,
    );
  }
  return { path, surface };
};

const liveSurfaceFor = (inventory: DomInventory): RevealSurface =>
  revealSurfaceFor(inventory.controls);

const currentUrlFor = (page: Page): string => canonicalRevealUrlFor(page.url());

const requireEqual = (
  actual: string,
  expected: string,
  description: string,
): void => {
  if (actual !== expected)
    throw new FrozenRevealReplayError(
      `${description}: expected=${expected} actual=${actual}`,
    );
};

const requireSurface = (
  actual: RevealSurface,
  expected: RevealSurface,
  description: string,
): void => {
  requireEqual(actual.digest, expected.digest, `${description} surface drift`);
};

const expectedTargetFor = (
  surface: RevealSurface,
  action: Action,
  index: number,
): RevealSurfaceControl => {
  const expected = surface.controls.find(
    ({ controlKey }) => controlKey === action.controlKey,
  );
  if (expected === undefined)
    throw new FrozenRevealReplayError(
      `Frozen reveal action ${index} target is absent from before surface: ${action.controlKey}`,
    );
  return expected;
};

const requireProof = (
  actual: RevealNonMutationProof,
  expected: RevealNonMutationProof,
  index: number,
): void => {
  requireEqual(
    actual.status,
    expected.status,
    `Frozen reveal action ${index} database proof status drift`,
  );
  requireEqual(
    actual.beforeDigest,
    expected.beforeDigest,
    `Frozen reveal action ${index} database before proof drift`,
  );
  requireEqual(
    actual.afterDigest,
    expected.afterDigest,
    `Frozen reveal action ${index} database after proof drift`,
  );
};

const requireActionResult = (
  result: FrozenRevealActionResult,
  index: number,
): void => {
  if (result !== undefined && result.status !== "pass")
    throw new FrozenRevealReplayError(
      `Frozen reveal action ${index} did not pass: ${result.status}`,
    );
};

const expectedInitialSurfaceFor = (
  path: RevealPath,
  expected: RevealSurface,
): RevealSurface => path.steps[0]?.before ?? expected;

type ReplayState = Readonly<{
  readonly inventory: DomInventory;
  readonly surface: RevealSurface;
}>;

const replayStep = async (
  input: FrozenRevealReplayInput,
  previous: ReplayState,
  step: RevealPath["steps"][number],
  index: number,
): Promise<ReplayState> => {
  requireEqual(
    currentUrlFor(input.page),
    step.beforeUrl,
    `Frozen reveal action ${index} before URL`,
  );
  requireSurface(
    previous.surface,
    step.before,
    `Frozen reveal action ${index} before`,
  );
  const target = assertFrozenRevealTarget(
    previous.inventory,
    expectedTargetFor(step.before, step, index),
  );
  const proof = await input.proveNonMutation(async () => {
    requireActionResult(await input.execute(input.page, step, target), index);
    await input.settle?.();
  });
  requireProof(proof, step.nonMutation, index);
  const inventory = await input.inventory(input.page);
  const surface = liveSurfaceFor(inventory);
  requireEqual(
    currentUrlFor(input.page),
    step.afterUrl,
    `Frozen reveal action ${index} after URL`,
  );
  requireSurface(surface, step.after, `Frozen reveal action ${index} after`);
  return { inventory, surface };
};

const replaySteps = (
  input: FrozenRevealReplayInput,
  path: RevealPath,
  initial: ReplayState,
): Promise<ReplayState> =>
  path.steps.reduce<Promise<ReplayState>>(
    (previous, step, index) =>
      previous.then((state) => replayStep(input, state, step, index)),
    Promise.resolve(initial),
  );

const replayRevealPath = async (
  input: FrozenRevealReplayInput,
): Promise<FrozenRevealReplayResult> => {
  const { path, surface } = input.preparation;
  const initial = await input.inventory(input.page);
  requireEqual(
    currentUrlFor(input.page),
    path.initialUrl,
    "Frozen reveal initial URL",
  );
  requireSurface(
    liveSurfaceFor(initial),
    expectedInitialSurfaceFor(path, surface),
    "Frozen reveal initial",
  );
  const final = await replaySteps(input, path, {
    inventory: initial,
    surface: liveSurfaceFor(initial),
  });
  requireEqual(
    currentUrlFor(input.page),
    path.steps.at(-1)?.afterUrl ?? path.initialUrl,
    "Frozen reveal final URL",
  );
  requireSurface(final.surface, surface, "Frozen reveal final");
  return {
    actionCount: path.steps.length,
    finalUrl: currentUrlFor(input.page),
    finalSurfaceDigest: final.surface.digest,
  };
};

export const replayFrozenRevealPath = async (
  input: FrozenRevealReplayInput,
): Promise<FrozenRevealReplayResult> => {
  try {
    return await replayRevealPath(input);
  } catch (error: unknown) {
    await input.cleanup();
    throw error;
  }
};
