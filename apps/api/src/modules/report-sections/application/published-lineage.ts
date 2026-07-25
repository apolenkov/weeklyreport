/**
 * Published lineage of a section's records: the durable `stableId`s of items
 * and decisions that have appeared in a published report. The delete-lock
 * (resolve-not-delete, ADR 0015) keys on this set — a saveSection payload that
 * omits or rewrites one of these lineages is rejected server-side, because the
 * client-authoritative `stableId` cannot be trusted to preserve identity.
 *
 * Risks are intentionally absent: a risk is re-raised, not carried, so the
 * lifecycle rule is narrowed to items + decisions (see the change design).
 */
export interface PublishedLineage {
  readonly itemStableIds: readonly string[];
  readonly decisionStableIds: readonly string[];
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !isUnknownArray(value);
}

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

function collectStableIds(rows: unknown): Set<string> {
  if (!isUnknownArray(rows)) return new Set();
  return new Set(
    rows.flatMap((row) =>
      isRecord(row) && typeof row.stableId === "string" ? [row.stableId] : [],
    ),
  );
}

/**
 * Tolerant reader over the frozen `Report.publishedSnapshot` JSON (a
 * serialized `AssembledReport`). Returns the item/decision `stableId`s the
 * snapshot holds for one section. Hand-rolled instead of a Zod parse so a
 * legacy snapshot (pre-stableId, or a shape drift) degrades to an empty set —
 * the lock then simply does not fire for those rows — rather than 500-ing
 * every save on a reopened period.
 * @param snapshot - The snapshot argument.
 * @param reportSectionId - The reportSectionId argument.
 */
export function snapshotLineageForSection(
  snapshot: unknown,
  reportSectionId: string,
): { itemStableIds: Set<string>; decisionStableIds: Set<string> } {
  const empty = {
    itemStableIds: new Set<string>(),
    decisionStableIds: new Set<string>(),
  };
  if (!isRecord(snapshot) || !isUnknownArray(snapshot.sections)) return empty;
  const section = snapshot.sections.find(
    (candidate) =>
      isRecord(candidate) && candidate.reportSectionId === reportSectionId,
  );
  if (!isRecord(section)) return empty;
  return {
    itemStableIds: collectStableIds(section.items),
    decisionStableIds: collectStableIds(section.decisions),
  };
}

/**
 * Union of every item/decision `stableId` a snapshot holds across ALL its
 * sections. Used for cross-report lineage from OTHER reopened periods, where
 * the live rows are untrustworthy (editable) but the frozen snapshot is not.
 * @param snapshot - The snapshot argument.
 */
export function snapshotLineageAllSections(snapshot: unknown): {
  itemStableIds: Set<string>;
  decisionStableIds: Set<string>;
} {
  if (!isRecord(snapshot) || !isUnknownArray(snapshot.sections)) {
    return {
      itemStableIds: new Set<string>(),
      decisionStableIds: new Set<string>(),
    };
  }
  const sections = snapshot.sections.filter(isRecord);
  return {
    itemStableIds: new Set(
      sections.flatMap((section) => [...collectStableIds(section.items)]),
    ),
    decisionStableIds: new Set(
      sections.flatMap((section) => [...collectStableIds(section.decisions)]),
    ),
  };
}

/**
 * Union Published Lineage.
 * @param sources - The sources argument.
 */
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

/**
 * Resolve Published Lineage.
 * @param candidates - The candidates argument.
 * @param sources - The sources argument.
 */
export function resolvePublishedLineage(
  candidates: LineageCandidates,
  sources: readonly PublishedLineageSource[],
): PublishedLineage {
  return intersectLineageCandidates(candidates, unionPublishedLineage(sources));
}
