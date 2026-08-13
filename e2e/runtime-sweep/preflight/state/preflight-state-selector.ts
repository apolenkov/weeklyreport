import { freezeDeep } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import type { PreflightCanarySelection } from "../canary/preflight-canary-contract.ts";
import { resolvePreflightCanarySelection } from "../canary/preflight-canary-selection.ts";
import {
  journalStateSchema,
  preflightJournalStateDigest,
} from "../journal/preflight-journal-contract.ts";
import {
  type PreflightStateSelection,
  type PreflightStateSelector,
  PreflightStateSelectorError,
  preflightStateSelectorSchema,
  type PreflightStateSemanticSelector,
  preflightStateSemanticSelectorSchema,
} from "./preflight-state-selector-contract.ts";

export {
  type PreflightStateSelection,
  type PreflightStateSelector,
  PreflightStateSelectorError,
  preflightStateSelectorSchema,
  type PreflightStateSemanticSelector,
  preflightStateSemanticSelectorSchema,
} from "./preflight-state-selector-contract.ts";
const selectorBody = (
  selector: PreflightStateSelector,
): Omit<PreflightStateSelector, "selectorDigest"> => {
  const { selectorDigest: _selectorDigest, ...body } = selector;
  return body;
};
const journalStateFor = (state: SourceArtifact["plan"]["states"][number]) =>
  journalStateSchema.parse({
    stateId: state.stateId,
    pairwiseDigest: state.pairwiseDigest,
    profile: state.profile,
    axes: state.axes,
  });

export const preflightStateDigestFor = (input: {
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly role: string;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
}): string =>
  preflightJournalStateDigest({
    state: journalStateFor(input.state),
    role: input.role,
    catalogRoute: input.catalogRoute,
    resolvedRoute: input.resolvedRoute,
  });
const assertUniqueStateIds = (source: SourceArtifact): void => {
  const seen = new Set<string>();
  for (const { stateId } of source.plan.states) {
    if (seen.has(stateId))
      throw new PreflightStateSelectorError(
        `SOURCE.json contains duplicate state identity: ${stateId}`,
      );
    seen.add(stateId);
  }
};
const sourceIdentityIssues = (
  source: SourceArtifact,
  selector: PreflightStateSelector,
): readonly string[] =>
  (
    [
      ["source SHA", selector.sourceSha === source.sourceSha],
      ["source tree", selector.sourceTree === source.sourceTree],
      ["tree digest", selector.treeDigest === source.treeDigest],
      ["source digest", selector.sourceDigest === source.sourceDigest],
      ["plan digest", selector.planDigest === source.plan.digest],
    ] as const
  )
    .filter(([, matches]) => !matches)
    .map(([field]) => field);
const selectorForSelection = (input: {
  readonly source: SourceArtifact;
  readonly selection: PreflightCanarySelection;
}): PreflightStateSelector => {
  const { source, selection } = input;
  const { state, route } = selection;
  const body = {
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    treeDigest: source.treeDigest,
    sourceDigest: source.sourceDigest,
    planDigest: source.plan.digest,
    stateId: state.stateId,
    stateDigest: preflightStateDigestFor({
      state,
      role: route.role,
      catalogRoute: route.catalogRoute,
      resolvedRoute: route.resolvedRoute,
    }),
    profile: state.profile,
    pairwiseDigest: state.pairwiseDigest,
    axes: state.axes,
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
  } as const;
  return preflightStateSelectorSchema.parse({
    ...body,
    selectorDigest: sha256Hex(body),
  });
};

const expectedSelectorFor = (input: {
  readonly source: SourceArtifact;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightCanarySelection["route"];
}): PreflightStateSelector =>
  selectorForSelection({
    source: input.source,
    selection: {
      selector: { stateId: input.state.stateId },
      state: input.state,
      route: input.route,
    },
  });

const assertSelectorDigest = (selector: PreflightStateSelector): void => {
  if (sha256Hex(selectorBody(selector)) !== selector.selectorDigest)
    throw new PreflightStateSelectorError(
      "Preflight state selector digest does not match contents",
    );
};

export function parsePreflightStateSelector(
  value: unknown,
): PreflightStateSelector {
  try {
    const selector = preflightStateSelectorSchema.parse(value);
    assertSelectorDigest(selector);
    return freezeDeep(selector);
  } catch (error: unknown) {
    if (error instanceof PreflightStateSelectorError) throw error;
    throw new PreflightStateSelectorError(
      `Invalid preflight state selector: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function createPreflightStateSelector(input: {
  readonly source: SourceArtifact;
  readonly state: SourceArtifact["plan"]["states"][number];
}): PreflightStateSelector {
  assertUniqueStateIds(input.source);
  const selection = resolvePreflightCanarySelection({
    source: input.source,
    selector: { stateId: input.state.stateId },
    expectedSourceSha: input.source.sourceSha,
  });
  if (stableSerialize(selection.state) !== stableSerialize(input.state))
    throw new PreflightStateSelectorError(
      `State payload does not match current SOURCE.json: ${input.state.stateId}`,
    );
  return freezeDeep(selectorForSelection({ source: input.source, selection }));
}

const selectorIssuesFor = (input: {
  readonly selector: PreflightStateSelector;
  readonly expected: PreflightStateSelector;
}): readonly string[] => {
  const { selector, expected } = input;
  return (
    [
      ["state identity", selector.stateId === expected.stateId],
      ["state digest", selector.stateDigest === expected.stateDigest],
      ["pairwise digest", selector.pairwiseDigest === expected.pairwiseDigest],
      ["profile", selector.profile === expected.profile],
      [
        "axes",
        stableSerialize(selector.axes) === stableSerialize(expected.axes),
      ],
      ["role", selector.role === expected.role],
      ["catalog route", selector.catalogRoute === expected.catalogRoute],
      ["resolved route", selector.resolvedRoute === expected.resolvedRoute],
    ] as const
  )
    .filter(([, matches]) => !matches)
    .map(([field]) => field);
};

const canarySelectionFor = (
  source: SourceArtifact,
  stateId: string,
): PreflightCanarySelection => {
  try {
    return resolvePreflightCanarySelection({
      source,
      selector: { stateId },
      expectedSourceSha: source.sourceSha,
    });
  } catch (error: unknown) {
    throw new PreflightStateSelectorError(
      `Cannot resolve preflight state ${stateId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const semanticSelectorFor = (
  value: unknown,
): PreflightStateSemanticSelector => {
  try {
    return preflightStateSemanticSelectorSchema.parse(value);
  } catch (error: unknown) {
    throw new PreflightStateSelectorError(
      `Invalid preflight semantic state selector: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export function resolvePreflightStateSelector(input: {
  readonly source: SourceArtifact;
  readonly selector: unknown;
}): PreflightStateSelection {
  const selector = parsePreflightStateSelector(input.selector);
  const sourceIssues = sourceIdentityIssues(input.source, selector);
  if (sourceIssues.length > 0)
    throw new PreflightStateSelectorError(
      `Preflight state selector has mismatched source identity: ${sourceIssues.join(
        ", ",
      )}`,
    );
  assertUniqueStateIds(input.source);
  const canarySelection = canarySelectionFor(input.source, selector.stateId);
  const expected = expectedSelectorFor({
    source: input.source,
    state: canarySelection.state,
    route: canarySelection.route,
  });
  const issues = selectorIssuesFor({ selector, expected });
  if (issues.length > 0)
    throw new PreflightStateSelectorError(
      `Preflight state selector does not match current SOURCE.json: ${issues.join(
        ", ",
      )}`,
    );
  return freezeDeep({
    selector,
    state: canarySelection.state,
    route: canarySelection.route,
  });
}

const semanticMatches = (
  semantic: PreflightStateSemanticSelector,
  state: SourceArtifact["plan"]["states"][number],
  route: PreflightCanarySelection["route"],
): boolean =>
  state.profile === semantic.profile &&
  stableSerialize(state.axes) === stableSerialize(semantic.axes) &&
  route.role === semantic.role &&
  route.catalogRoute === semantic.catalogRoute &&
  route.resolvedRoute === semantic.resolvedRoute;

export function resolvePreflightStateBySemantics(input: {
  readonly source: SourceArtifact;
  readonly semantic: unknown;
}): PreflightStateSelection {
  const semantic = semanticSelectorFor(input.semantic);
  assertUniqueStateIds(input.source);
  const matches = input.source.plan.states.flatMap((state) => {
    const route = canarySelectionFor(input.source, state.stateId).route;
    return semanticMatches(semantic, state, route) ? [{ state, route }] : [];
  });
  if (matches.length === 0)
    throw new PreflightStateSelectorError(
      "Semantic preflight state selector matched no current SOURCE state",
    );
  if (matches.length > 1)
    throw new PreflightStateSelectorError(
      "Semantic preflight state selector matched multiple current SOURCE states",
    );
  const match = matches[0];
  if (match === undefined)
    throw new PreflightStateSelectorError(
      "Semantic preflight state selector did not produce one match",
    );
  return resolvePreflightStateSelector({
    source: input.source,
    selector: createPreflightStateSelector({
      source: input.source,
      state: match.state,
    }),
  });
}

export const resolvePreflightStateSemanticSelector =
  resolvePreflightStateBySemantics;
export const mapPreflightStateBySemantics = resolvePreflightStateBySemantics;
