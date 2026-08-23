import { stableSerialize } from "../../../support/ids.ts";
import {
  type BranchView,
  sequenceFor,
  type ToggleBinding,
  toggleBindingsAnalysisFor,
  uniqueBindingsFor,
  untrustedDisclosureFor,
} from "./preflight-reveal-canonicalization.ts";
import {
  matchesUnion,
  type RevealSurfaceMaterial,
  revealSurfaceMaterialControlFor,
  revealSurfaceMaterialFor,
  revealSurfaceMaterialIdentityFor,
  revealSurfaceMaterialSignatureFor,
  sameRevealSurfaceMaterial,
} from "./reveal-surface-material.ts";

export type BranchSequenceLookup = Readonly<
  | { readonly kind: "missing" }
  | { readonly kind: "conflict" }
  | { readonly kind: "match"; readonly branch: BranchView }
>;

type BindingPair = Readonly<{
  readonly left: ToggleBinding;
  readonly right: ToggleBinding;
  readonly leftIndex: number;
  readonly rightIndex: number;
}>;

const preparedRootIdentityFor = (surface: BranchView["surface"]): string =>
  stableSerialize(
    surface.controls
      .toSorted(
        (left, right) =>
          left.order - right.order ||
          left.domOrderKey.localeCompare(right.domOrderKey) ||
          left.controlKey.localeCompare(right.controlKey),
      )
      .map((control) => {
        const material = revealSurfaceMaterialControlFor(control);
        return [
          control.order,
          revealSurfaceMaterialIdentityFor(material),
          revealSurfaceMaterialSignatureFor(material),
        ];
      }),
  );

const isTrustedProofBranch = (
  branch: BranchView,
  rootIdentity: string,
): boolean => {
  const analysis = toggleBindingsAnalysisFor(branch.path);
  const firstBefore = branch.path.steps[0]?.before;
  return (
    analysis.eligible &&
    uniqueBindingsFor(analysis.bindings) &&
    (firstBefore === undefined
      ? false
      : preparedRootIdentityFor(firstBefore) === rootIdentity) &&
    branch.path.steps
      .flatMap(({ before, after }) => [before, after])
      .every((surface) => untrustedDisclosureFor(surface) === undefined)
  );
};

const branchForSequence = (
  knownBranches: readonly BranchView[],
  initialUrl: string,
  sequence: readonly string[],
  rootIdentity: string,
): BranchSequenceLookup => {
  const matches = knownBranches.filter(
    (branch) =>
      branch.path.initialUrl === initialUrl &&
      stableSerialize(sequenceFor(branch.path)) === stableSerialize(sequence),
  );
  const first = matches[0];
  if (first === undefined) return { kind: "missing" };
  if (!matches.every((branch) => isTrustedProofBranch(branch, rootIdentity)))
    return { kind: "conflict" };
  return matches.every(
    (match) =>
      match.url === first.url &&
      sameRevealSurfaceMaterial(match.surface, first.surface),
  )
    ? { kind: "match", branch: first }
    : { kind: "conflict" };
};

const bindingPairsFor = (
  bindings: readonly ToggleBinding[],
): readonly BindingPair[] =>
  bindings.flatMap((left, leftIndex) =>
    bindings.slice(leftIndex + 1).map((right, offset) => ({
      left,
      right,
      leftIndex,
      rightIndex: leftIndex + offset + 1,
    })),
  );

const pairOrderEquivalentFor = (input: {
  readonly pair: BindingPair;
  readonly knownBranches: readonly BranchView[];
  readonly initialUrl: string;
  readonly root: RevealSurfaceMaterial;
  readonly rootIdentity: string;
  readonly singles: readonly BranchView[];
}): boolean => {
  const { pair } = input;
  const lookup = (sequence: readonly string[]) =>
    branchForSequence(
      input.knownBranches,
      input.initialUrl,
      sequence,
      input.rootIdentity,
    );
  const forward = lookup([pair.left.identity, pair.right.identity]);
  const reverse = lookup([pair.right.identity, pair.left.identity]);
  const leftSingle = input.singles[pair.leftIndex];
  const rightSingle = input.singles[pair.rightIndex];
  if (
    forward.kind !== "match" ||
    reverse.kind !== "match" ||
    leftSingle === undefined ||
    rightSingle === undefined ||
    forward.branch.url !== input.initialUrl ||
    reverse.branch.url !== input.initialUrl ||
    !sameRevealSurfaceMaterial(forward.branch.surface, reverse.branch.surface)
  )
    return false;
  return matchesUnion({
    root: input.root,
    singles: [leftSingle, rightSingle],
    actual: revealSurfaceMaterialFor(forward.branch.surface),
  });
};

export const singleProofBranchesFor = (input: {
  readonly bindings: readonly ToggleBinding[];
  readonly knownBranches: readonly BranchView[];
  readonly initialUrl: string;
  readonly rootSurface: BranchView["surface"];
}): readonly BranchSequenceLookup[] => {
  const rootIdentity = preparedRootIdentityFor(input.rootSurface);
  return input.bindings.map(({ identity }) =>
    branchForSequence(
      input.knownBranches,
      input.initialUrl,
      [identity],
      rootIdentity,
    ),
  );
};

export const allPairOrdersEquivalentFor = (input: {
  readonly bindings: readonly ToggleBinding[];
  readonly knownBranches: readonly BranchView[];
  readonly initialUrl: string;
  readonly root: RevealSurfaceMaterial;
  readonly rootSurface: BranchView["surface"];
  readonly singles: readonly BranchView[];
}): boolean => {
  const rootIdentity = preparedRootIdentityFor(input.rootSurface);
  return bindingPairsFor(input.bindings).every((pair) =>
    pairOrderEquivalentFor({ ...input, pair, rootIdentity }),
  );
};
