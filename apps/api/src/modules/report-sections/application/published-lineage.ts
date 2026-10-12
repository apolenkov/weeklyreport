import type { PublishedLineage } from "@weeklyreport/shared";

// Published lineage: durable item/decision `stableId`s that have appeared in a
// published report; the delete-lock rejects save payloads omitting/rewriting
// one (client stableId untrusted). Risks are absent — re-raised, never carried.
export interface PublishedLineageSource {
  readonly itemStableIds: Iterable<string>;
  readonly decisionStableIds: Iterable<string>;
}

export interface LineageCandidates {
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly itemStableIds: readonly string[];
  readonly decisionStableIds: readonly string[];
}

export const EMPTY_PUBLISHED_LINEAGE: PublishedLineage = {
  itemStableIds: [],
  decisionStableIds: [],
};

export function unionPublishedLineage(
  sources: readonly PublishedLineageSource[],
): { itemStableIds: Set<string>; decisionStableIds: Set<string> } {
  return {
    itemStableIds: new Set(
      sources.flatMap((source) => [...source.itemStableIds]),
    ),
    decisionStableIds: new Set(
      sources.flatMap((source) => [...source.decisionStableIds]),
    ),
  };
}

function intersectLineageCandidates(
  candidates: LineageCandidates,
  published: {
    readonly itemStableIds: ReadonlySet<string>;
    readonly decisionStableIds: ReadonlySet<string>;
  },
): PublishedLineage {
  return {
    itemStableIds: candidates.itemStableIds.filter((id) =>
      published.itemStableIds.has(id),
    ),
    decisionStableIds: candidates.decisionStableIds.filter((id) =>
      published.decisionStableIds.has(id),
    ),
  };
}

export function resolvePublishedLineage(
  candidates: LineageCandidates,
  sources: readonly PublishedLineageSource[],
): PublishedLineage {
  return intersectLineageCandidates(candidates, unionPublishedLineage(sources));
}
