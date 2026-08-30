// Published lineage: durable item/decision `stableId`s that have appeared in a
// published report; the delete-lock rejects save payloads omitting/rewriting
// one (client stableId untrusted). Risks are absent — re-raised, never carried.
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

// Raised when a stored `Report.publishedSnapshot` is structurally malformed:
// the frozen record set cannot be trusted, so the delete-lock fails closed
// (blocks the save) rather than treating every record as unpublishable.
export class PublishedSnapshotIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishedSnapshotIntegrityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !isUnknownArray(value);
}

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

function assertSnapshotShape(
  snapshot: unknown,
): asserts snapshot is Record<string, unknown> & { sections: unknown[] } {
  if (!isRecord(snapshot) || !isUnknownArray(snapshot.sections)) {
    throw new PublishedSnapshotIntegrityError(
      "The published snapshot is malformed — record protection cannot be verified.",
    );
  }
}

function collectStableIds(rows: unknown, field: string): Set<string> {
  if (!isUnknownArray(rows)) {
    throw new PublishedSnapshotIntegrityError(
      `The published snapshot has no valid ${field} array.`,
    );
  }
  const ids = new Set<string>();
  for (const row of rows) {
    if (!isRecord(row) || typeof row.stableId !== "string") {
      throw new PublishedSnapshotIntegrityError(
        `The published snapshot has a ${field} row without stableId.`,
      );
    }
    ids.add(row.stableId);
  }
  return ids;
}

// Tolerant reader over the frozen `Report.publishedSnapshot` JSON returning one
// section's item/decision `stableId`s: null reads empty, malformed snapshots
// throw (fail-closed protection).
export function snapshotLineageForSection(
  snapshot: unknown,
  reportSectionId: string,
): { itemStableIds: Set<string>; decisionStableIds: Set<string> } {
  const empty = {
    itemStableIds: new Set<string>(),
    decisionStableIds: new Set<string>(),
  };
  if (snapshot == null) return empty;
  assertSnapshotShape(snapshot);
  const section = snapshot.sections.find(
    (candidate) =>
      isRecord(candidate) && candidate.reportSectionId === reportSectionId,
  );
  if (!isRecord(section)) return empty;
  return {
    itemStableIds: collectStableIds(section.items, "items"),
    decisionStableIds: collectStableIds(section.decisions, "decisions"),
  };
}

// Union of every item/decision `stableId` across ALL snapshot sections. Used for
// cross-report lineage from OTHER reopened periods, where live rows are editable
// but the frozen snapshot is not. Same fail-closed shape rule as the section reader.
export function snapshotLineageAllSections(snapshot: unknown): {
  itemStableIds: Set<string>;
  decisionStableIds: Set<string>;
} {
  if (snapshot == null) {
    return {
      itemStableIds: new Set<string>(),
      decisionStableIds: new Set<string>(),
    };
  }
  assertSnapshotShape(snapshot);
  const sections = snapshot.sections.filter(isRecord);
  return {
    itemStableIds: new Set(
      sections.flatMap((section) => [
        ...collectStableIds(section.items, "items"),
      ]),
    ),
    decisionStableIds: new Set(
      sections.flatMap((section) => [
        ...collectStableIds(section.decisions, "decisions"),
      ]),
    ),
  };
}

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
