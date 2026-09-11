import type { StatusOverviewItem, StatusOverviewUnit } from "./status-overview";

export interface StatusOverviewLineageRow {
  readonly key: string;
  readonly previous: StatusOverviewItem | null;
  readonly current: StatusOverviewItem | null;
  readonly next: StatusOverviewItem | null;
  readonly previousParent: string | null;
}

export function isLinkedOverviewRow(row: StatusOverviewLineageRow): boolean {
  return row.previous !== null || (row.current !== null && row.next !== null);
}

function emptyRow(key: string): StatusOverviewLineageRow {
  return {
    key,
    previous: null,
    current: null,
    next: null,
    previousParent: null,
  };
}

type Source = StatusOverviewItem["source"];
const SOURCES = ["previous", "current", "next"] as const;
const COLUMN_BY_SOURCE = {
  previous: "previouslyPlanned",
  current: "currentWeek",
  next: "nextWeek",
} as const;

interface SourceEntry {
  readonly source: Source;
  readonly unit: StatusOverviewUnit;
  readonly item: StatusOverviewItem;
}

function entriesForSource(
  units: readonly StatusOverviewUnit[],
  source: Source,
): SourceEntry[] {
  return units.flatMap((unit) =>
    unit.columns[COLUMN_BY_SOURCE[source]].items.map((item) => ({
      source,
      unit,
      item,
    })),
  );
}

function targetUnit(
  entry: SourceEntry,
  destinations: ReadonlyMap<string, string>,
): string {
  if (entry.source !== "previous" || !entry.item.stableId)
    return entry.unit.key;
  return destinations.get(entry.item.stableId) ?? entry.unit.key;
}

// Resolve destination before grouping so a parent change does not split lineage.
export function buildStatusOverviewLineage(
  units: readonly StatusOverviewUnit[],
): ReadonlyMap<string, readonly StatusOverviewLineageRow[]> {
  const entries = SOURCES.flatMap((source) => entriesForSource(units, source));
  const destinations = new Map(
    entries.flatMap(({ source, item, unit }) =>
      source !== "previous" && item.stableId
        ? [[item.stableId, unit.key] as const]
        : [],
    ),
  );
  const rows = new Map<string, Map<string, StatusOverviewLineageRow>>(
    units.map((unit) => [unit.key, new Map()]),
  );
  for (const entry of entries) {
    const destination = targetUnit(entry, destinations);
    const group = rows.get(destination);
    if (!group) continue;
    const { item, source, unit } = entry;
    // Missing identity must never match another record merely by its text.
    const localKey =
      source !== "previous" && item.recordId
        ? `${unit.key}:record:${item.recordId}`
        : `${unit.key}:${item.key}`;
    const key = item.stableId ?? localKey;
    const row = group.get(key) ?? emptyRow(key);
    group.set(key, {
      ...row,
      [source]: item,
      previousParent:
        source === "previous" && destination !== unit.key
          ? unit.name
          : row.previousParent,
    });
  }
  return new Map([...rows].map(([key, group]) => [key, [...group.values()]]));
}
