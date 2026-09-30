import { STAGE_NAMES } from "@customreport/shared";

import { normalizeEntityReference } from "./entity-alias-index.js";
import {
  addToken,
  referenceKey,
  resolveReference,
  uniqueStrings,
} from "./entity-resolver.catalog.js";
import type {
  ClarificationTokenDescriptor,
  EntityResolutionOutcome,
  ReferenceSlot,
  ResolveSearchPlanInput,
  SearchPlanResolutionOutcome,
  SingleReferenceOutcome,
} from "./entity-resolver.types.js";

const stageReferenceId = (reference: string): string | null => {
  const normalized = normalizeEntityReference(reference);
  const canonical = STAGE_NAMES.find(
    (stage) => normalizeEntityReference(stage) === normalized,
  );
  if (canonical) return canonical;
  return normalized === "dev" ? "Development" : null;
};

const resolveStageReferences = (
  references: readonly string[],
): readonly string[] | null => {
  const stageIds = references.map(stageReferenceId);
  return stageIds.includes(null)
    ? null
    : uniqueStrings(stageIds.filter((id): id is string => id !== null));
};

const slotsForPlan = (
  plan: ResolveSearchPlanInput["plan"],
): readonly ReferenceSlot[] => [
  ...(plan.authors.mode === "selected"
    ? plan.authors.references.map((reference) => ({
        kind: "author" as const,
        reference,
      }))
    : []),
  ...plan.subjects.productReferences.map((reference) => ({
    kind: "product" as const,
    reference,
  })),
  ...plan.subjects.activityReferences.map((reference) => ({
    kind: "activity" as const,
    reference,
  })),
  ...(plan.periods.published.mode === "named"
    ? plan.periods.published.references.map((reference) => ({
        kind: "period" as const,
        reference,
      }))
    : []),
];

const decodeResolutionTokens = (
  input: ResolveSearchPlanInput,
  slots: readonly ReferenceSlot[],
): ReadonlyMap<string, readonly ClarificationTokenDescriptor[]> | null => {
  const slotKeys = new Set(
    slots.map((slot) => referenceKey(slot.kind, slot.reference)),
  );
  const decodedTokens = input.resolutionTokens.map((token) =>
    input.tokenCodec.decode(token, input.actorId),
  );
  const validTokens = decodedTokens.filter(
    (token): token is ClarificationTokenDescriptor => token !== null,
  );
  if (validTokens.length !== decodedTokens.length) return null;
  if (
    validTokens.some(
      (token) => !slotKeys.has(referenceKey(token.entityKind, token.reference)),
    )
  ) {
    return null;
  }
  return validTokens.reduce<
    ReadonlyMap<string, readonly ClarificationTokenDescriptor[]>
  >(addToken, new Map<string, readonly ClarificationTokenDescriptor[]>());
};

const resolveSlots = (
  input: ResolveSearchPlanInput,
  slots: readonly ReferenceSlot[],
  tokenIndex: ReadonlyMap<string, readonly ClarificationTokenDescriptor[]>,
): readonly SingleReferenceOutcome[] =>
  slots.map((slot) => resolveReference(input.catalog, slot, tokenIndex, input));

const firstFailure = (
  outcomes: readonly SingleReferenceOutcome[],
): SingleReferenceOutcome | undefined =>
  outcomes.find((outcome) => outcome.kind !== "resolved");

const resolvedIds = (
  outcome: SingleReferenceOutcome | undefined,
): readonly string[] => (outcome?.kind === "resolved" ? [outcome.id] : []);

const idsForKind = (
  slots: readonly ReferenceSlot[],
  outcomes: readonly SingleReferenceOutcome[],
  kind: ReferenceSlot["kind"],
): readonly string[] =>
  uniqueStrings(
    slots.flatMap((slot, index) =>
      slot.kind === kind ? resolvedIds(outcomes[index]) : [],
    ),
  );

const visibleAuthorIds = (
  input: ResolveSearchPlanInput,
  includeSelf: boolean,
): readonly string[] =>
  uniqueStrings([
    ...input.catalog.entities
      .filter((entity) => entity.kind === "author")
      .map((entity) => entity.id),
    ...(includeSelf ? [input.actorId] : []),
  ]).filter((id) => includeSelf || id !== input.actorId);

const authorIdsForPlan = (
  input: ResolveSearchPlanInput,
  slots: readonly ReferenceSlot[],
  outcomes: readonly SingleReferenceOutcome[],
): readonly string[] => {
  const { authors } = input.plan;
  if (authors.mode === "self") return [input.actorId];
  if (authors.mode === "all_visible") {
    return visibleAuthorIds(input, authors.includeSelf);
  }

  return uniqueStrings([
    ...idsForKind(slots, outcomes, "author"),
    ...(authors.includeSelf ? [input.actorId] : []),
  ]);
};

export function resolveAccessibleEntities(
  input: ResolveSearchPlanInput,
): EntityResolutionOutcome {
  const slots = slotsForPlan(input.plan);
  const tokenIndex = decodeResolutionTokens(input, slots);
  if (tokenIndex === null) return { kind: "no_results" };

  const outcomes = resolveSlots(input, slots, tokenIndex);
  const failure = firstFailure(outcomes);
  if (failure?.kind === "clarification_required") return failure;
  if (failure) return { kind: "no_results" };

  const stageIds = resolveStageReferences(input.plan.stages.references);
  if (stageIds === null) return { kind: "no_results" };

  return {
    kind: "resolved",
    references: {
      authorIds: authorIdsForPlan(input, slots, outcomes),
      productIds: idsForKind(slots, outcomes, "product"),
      activityIds: idsForKind(slots, outcomes, "activity"),
      stageIds,
      periodIds: idsForKind(slots, outcomes, "period"),
    },
  };
}

export function resolveSearchPlanEntities(
  input: ResolveSearchPlanInput,
): SearchPlanResolutionOutcome {
  const resolved = resolveAccessibleEntities(input);
  if (resolved.kind !== "resolved") return resolved;

  return {
    kind: "resolved",
    plan: {
      plan: input.plan,
      occurrences: input.occurrences,
      sectionScopes: input.sectionScopes,
      ...resolved.references,
    },
  };
}
