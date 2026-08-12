import type {
  MatrixPreflightControl,
  MatrixPreflightSegment,
} from "../matrix/matrix-finalizer-contract.ts";
import { assertControlTransition } from "../matrix/matrix-preflight-transition-validation.ts";
import {
  parseRevealTransition,
  type RevealTransition,
} from "../matrix/reveal-transition.ts";
import {
  assertRevealSegmentPreparations,
  parseRevealPath,
  parseRevealSurface,
  type RevealPath,
  type RevealSurface,
} from "./reveal-path.ts";

type CompactPreflightControl = Omit<
  MatrixPreflightControl,
  | "revealPath"
  | "expectedSurface"
  | "expectedActionTransition"
  | "expectedActionSurface"
> &
  Readonly<{
    readonly revealPathDigest: string;
    readonly expectedSurfaceDigest: string;
    readonly expectedActionTransitionDigest: string | null;
    readonly expectedActionSurfaceDigest: string | null;
  }>;

export type CompactPreflightSegment = Omit<MatrixPreflightSegment, "controls"> &
  Readonly<{ readonly controls: readonly CompactPreflightControl[] }>;

const uniqueByDigest = <T extends Readonly<{ readonly digest: string }>>(
  values: readonly T[],
): readonly T[] =>
  [
    ...new Map(values.map((value) => [value.digest, value] as const)).values(),
  ].toSorted((left, right) => left.digest.localeCompare(right.digest));

export const compactPreflightRevealData = (
  segments: readonly MatrixPreflightSegment[],
): Readonly<{
  readonly segments: readonly CompactPreflightSegment[];
  readonly revealPaths: readonly RevealPath[];
  readonly revealSurfaces: readonly RevealSurface[];
  readonly revealTransitions: readonly RevealTransition[];
}> => ({
  segments: segments.map((segment) => ({
    ...segment,
    controls: segment.controls.map(
      ({
        revealPath,
        expectedSurface,
        expectedActionTransition,
        expectedActionSurface,
        ...control
      }) => ({
        ...control,
        revealPathDigest: revealPath.digest,
        expectedSurfaceDigest: expectedSurface.digest,
        expectedActionTransitionDigest:
          expectedActionTransition?.digest ?? null,
        expectedActionSurfaceDigest: expectedActionSurface?.digest ?? null,
      }),
    ),
  })),
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
});

export const inflatePreflightRevealData = (
  input: Readonly<{
    readonly segments: readonly CompactPreflightSegment[];
    readonly revealPaths: readonly RevealPath[];
    readonly revealSurfaces: readonly RevealSurface[];
    readonly revealTransitions: readonly RevealTransition[];
  }>,
): readonly MatrixPreflightSegment[] => {
  const paths = new Map(
    input.revealPaths.map((path) => [path.digest, parseRevealPath(path)]),
  );
  const surfaces = new Map(
    input.revealSurfaces.map((surface) => [
      surface.digest,
      parseRevealSurface(surface),
    ]),
  );
  const transitions = new Map(
    input.revealTransitions.map((transition) => [
      transition.digest,
      parseRevealTransition(transition),
    ]),
  );
  if (paths.size !== input.revealPaths.length)
    throw new Error("PREFLIGHT.json contains duplicate reveal paths");
  if (surfaces.size !== input.revealSurfaces.length)
    throw new Error("PREFLIGHT.json contains duplicate reveal surfaces");
  if (transitions.size !== input.revealTransitions.length)
    throw new Error("PREFLIGHT.json contains duplicate reveal transitions");
  return input.segments.map((segment) => ({
    ...segment,
    controls: segment.controls.map(
      ({
        revealPathDigest,
        expectedSurfaceDigest,
        expectedActionTransitionDigest,
        expectedActionSurfaceDigest,
        ...control
      }) => {
        const revealPath = paths.get(revealPathDigest);
        const expectedSurface = surfaces.get(expectedSurfaceDigest);
        const expectedActionTransition =
          expectedActionTransitionDigest === null
            ? null
            : transitions.get(expectedActionTransitionDigest);
        const expectedActionSurface =
          expectedActionSurfaceDigest === null
            ? null
            : surfaces.get(expectedActionSurfaceDigest);
        if (
          revealPath === undefined ||
          expectedSurface === undefined ||
          expectedActionTransition === undefined ||
          expectedActionSurface === undefined
        )
          throw new Error(
            "PREFLIGHT.json contains unresolved reveal references",
          );
        return {
          ...control,
          revealPath,
          expectedSurface,
          expectedActionTransition,
          expectedActionSurface,
        };
      },
    ),
  }));
};

export const assertCompactPreflightRevealData = (
  input: Readonly<{
    readonly segments: readonly CompactPreflightSegment[];
    readonly revealPaths: readonly RevealPath[];
    readonly revealSurfaces: readonly RevealSurface[];
    readonly revealTransitions: readonly RevealTransition[];
  }>,
): void =>
  inflatePreflightRevealData(input).forEach(({ controls }) => {
    assertRevealSegmentPreparations(controls);
    controls.forEach((control) => {
      assertControlTransition(control);
    });
  });
