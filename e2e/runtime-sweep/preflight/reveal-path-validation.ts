import { stableSerialize } from "../support/ids.ts";
import {
  canonicalRevealUrlFor,
  parseRevealPath,
  parseRevealSurface,
  revealControlIdentityFor,
  type RevealPath,
  type RevealSurface,
} from "./reveal-path.ts";

type ParsedRevealStep = Readonly<{
  readonly step: RevealPath["steps"][number];
  readonly before: RevealSurface;
  readonly after: RevealSurface;
}>;

const assertSupportedOperation = (step: ParsedRevealStep["step"]): void => {
  const formAction = step.operation === "fill" || step.operation === "select";
  if (
    !formAction &&
    (step.operation !== "click" || step.safety !== "read-only")
  )
    throw new Error("Reveal path contains an unsupported mutation step");
};

const assertFormStep = (step: ParsedRevealStep["step"]): void => {
  if (
    (step.operation === "fill" || step.operation === "select") &&
    (step.safety !== "irreversible" ||
      step.transition !== "none" ||
      step.representativeInput?.kind !== step.operation)
  )
    throw new Error(
      "Reveal path form step lacks irreversible none-transition or matching representative input",
    );
};

const assertStepSource = (
  step: ParsedRevealStep["step"],
  before: RevealSurface,
): void => {
  if (step.operation === "click" && step.representativeInput !== undefined)
    throw new Error(
      "Reveal path click step carries a form representative input",
    );
  const source = before.controls.find(
    ({ controlKey }) => controlKey === step.controlKey,
  );
  if (source === undefined)
    throw new Error(
      `Reveal path step source is absent from before surface: ${step.controlKey}`,
    );
  if (!source.enabled)
    throw new Error(
      `Reveal path step targets disabled control ${step.controlKey}`,
    );
  if (step.target !== undefined && source.href !== step.target.href)
    throw new Error(`Reveal path link target changed for ${step.controlKey}`);
};

const assertStepAction = ({ step, before, after }: ParsedRevealStep): void => {
  assertSupportedOperation(step);
  assertFormStep(step);
  assertStepSource(step, before);
  if (before.digest === after.digest && step.beforeUrl === step.afterUrl)
    throw new Error("Reveal path step must change the semantic state");
};

const assertStepEvidence = ({ step }: ParsedRevealStep): void => {
  if (step.nonMutation.beforeDigest !== step.nonMutation.afterDigest)
    throw new Error("Reveal path step changed the prepared database state");
  if (
    canonicalRevealUrlFor(step.beforeUrl) !== step.beforeUrl ||
    canonicalRevealUrlFor(step.afterUrl) !== step.afterUrl
  )
    throw new Error("Reveal path URLs must be canonical");
};

const assertStepChain = (
  current: ParsedRevealStep,
  next: ParsedRevealStep | undefined,
  expectedSurface: RevealSurface,
): void => {
  if (next !== undefined) {
    if (stableSerialize(current.after) !== stableSerialize(next.before))
      throw new Error("Reveal path surfaces are not chained");
    if (current.step.afterUrl !== next.step.beforeUrl)
      throw new Error("Reveal path URLs are not chained");
    return;
  }
  if (stableSerialize(current.after) !== stableSerialize(expectedSurface))
    throw new Error(
      "Reveal path final surface does not match expected surface",
    );
};

const parsedStepsFor = (path: RevealPath): readonly ParsedRevealStep[] =>
  path.steps.map((step) => ({
    step,
    before: parseRevealSurface(step.before),
    after: parseRevealSurface(step.after),
  }));

const assertNoStateCycle = (
  path: RevealPath,
  steps: readonly ParsedRevealStep[],
): void => {
  const identities = [
    `${steps[0]?.before.digest ?? "empty"}:${path.initialUrl}`,
    ...steps.map(({ step, after }) => `${after.digest}:${step.afterUrl}`),
  ];
  if (new Set(identities).size !== identities.length)
    throw new Error("Reveal path repeats a semantic state");
};

const assertParsedRevealPathForSurface = (
  parsedPath: RevealPath,
  parsedSurface: RevealSurface,
): void => {
  const steps = parsedStepsFor(parsedPath);
  if (
    steps[0] !== undefined &&
    steps[0].step.beforeUrl !== parsedPath.initialUrl
  )
    throw new Error("Reveal path does not start at its frozen URL");
  steps.forEach((step, index) => {
    assertStepAction(step);
    assertStepEvidence(step);
    assertStepChain(step, steps[index + 1], parsedSurface);
  });
  assertNoStateCycle(parsedPath, steps);
};

export const assertRevealPath = (
  path: RevealPath,
  surface: RevealSurface,
): void =>
  assertParsedRevealPathForSurface(
    parseRevealPath(path),
    parseRevealSurface(surface),
  );

export const assertRevealPathForControl = (
  path: RevealPath,
  surface: RevealSurface,
  controlKey: string,
): void => {
  const parsedSurface = parseRevealSurface(surface);
  if (
    !parsedSurface.controls.some(
      ({ controlKey: candidate }) => candidate === controlKey,
    )
  )
    throw new Error(
      `Reveal surface does not contain target control ${controlKey}`,
    );
  assertParsedRevealPathForSurface(parseRevealPath(path), parsedSurface);
};

const assertRevealPreparations = (
  controls: readonly Readonly<{
    readonly controlKey: string;
    readonly revealPath: RevealPath;
    readonly expectedSurface: RevealSurface;
  }>[],
): void => {
  if (
    new Set(
      controls.map(({ controlKey, revealPath, expectedSurface }) =>
        revealControlIdentityFor({
          controlKey,
          revealPathDigest: revealPath.digest,
          expectedSurfaceDigest: expectedSurface.digest,
        }),
      ),
    ).size !== controls.length
  )
    throw new Error(
      "Reveal preparations contain duplicate scoped control identities",
    );
  const surfaces = controls.reduce(
    (result, { expectedSurface }) =>
      result.has(expectedSurface.digest)
        ? result
        : new Map([
            ...result.entries(),
            [
              expectedSurface.digest,
              parseRevealSurface(expectedSurface),
            ] as const,
          ]),
    new Map<string, RevealSurface>(),
  );
  const surfaceKeys = new Map(
    [...surfaces.entries()].map(([digest, surface]) => [
      digest,
      new Set(surface.controls.map(({ controlKey }) => controlKey)),
    ]),
  );
  controls.forEach(({ controlKey, revealPath, expectedSurface }) => {
    const surface = surfaces.get(expectedSurface.digest);
    const keys = surfaceKeys.get(expectedSurface.digest);
    if (surface === undefined || keys === undefined)
      throw new Error("Reveal preparation surface disappeared");
    if (!keys.has(controlKey))
      throw new Error(
        `Reveal surface does not contain target control ${controlKey}`,
      );
    assertParsedRevealPathForSurface(parseRevealPath(revealPath), surface);
  });
};

export const assertRevealSegmentPreparations = (
  controls: readonly Readonly<{
    readonly controlKey: string;
    readonly revealPath: RevealPath;
    readonly expectedSurface: RevealSurface;
  }>[],
): void => {
  assertRevealPreparations(controls);
  const roots = controls.filter(
    ({ revealPath }) => revealPath.steps.length === 0,
  );
  const root = roots[0]?.expectedSurface;
  const rootUrl = roots[0]?.revealPath.initialUrl;
  if (root === undefined && controls.length > 0)
    throw new Error("Reveal segment has no canonical initial surface");
  if (root === undefined) return;
  roots.forEach(({ expectedSurface, revealPath }) => {
    if (
      stableSerialize(expectedSurface) !== stableSerialize(root) ||
      revealPath.initialUrl !== rootUrl
    )
      throw new Error("Reveal segment has inconsistent initial surfaces");
  });
  controls
    .filter(({ revealPath }) => revealPath.steps.length > 0)
    .forEach(({ revealPath }) => {
      const first = revealPath.steps[0];
      if (
        first !== undefined &&
        (stableSerialize(first.before) !== stableSerialize(root) ||
          revealPath.initialUrl !== rootUrl)
      )
        throw new Error("Reveal path does not start at the canonical surface");
    });
};
