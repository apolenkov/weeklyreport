import type { StatusOverviewItem, StatusOverviewUnit } from "./status-overview";
import { compareIdentityOrder } from "./status-overview-item-order";
import type { PriorVerdictState } from "./status-overview-verdict";

export interface StatusOverviewLineageRow {
  readonly key: string;
  readonly stableId: string | null;
  readonly last: StatusOverviewItem | null;
  readonly current: StatusOverviewItem | null;
  readonly next: StatusOverviewItem | null;
  readonly priorCommitment: StatusOverviewItem | null;
  readonly answerState: PriorVerdictState | null;
  readonly previousParent: string | null;
}

const slots = {
  last: "lastWeek",
  priorCommitment: "priorCommitments",
  current: "currentWeek",
  next: "nextWeek",
} as const;
type Slot = keyof typeof slots;

export function buildStatusOverviewLineage(
  units: readonly StatusOverviewUnit[],
): ReadonlyMap<string, readonly StatusOverviewLineageRow[]> {
  const destinations = new Map<string, string>();
  for (const unit of units) {
    for (const item of [
      ...unit.columns.currentWeek.items,
      ...unit.columns.nextWeek.items,
    ]) {
      if (item.stableId && !destinations.has(item.stableId))
        destinations.set(item.stableId, unit.key);
    }
  }
  const groups = new Map(
    units.map((unit) => [
      unit.key,
      new Map<string, StatusOverviewLineageRow[]>(),
    ]),
  );
  for (const slot of Object.keys(slots) as Slot[]) {
    for (const unit of units)
      unit.columns[slots[slot]].items.forEach((item) =>
        appendOccurrence({ slot, unit, item }, { groups, destinations }),
      );
  }
  return new Map(
    [...groups].map(([key, group]) => [
      key,
      [...group.values()].flat().sort(compareIdentityOrder),
    ]),
  );
}

function availableSlot(
  rows: readonly StatusOverviewLineageRow[],
  slot: Slot,
  item: StatusOverviewItem,
) {
  const partner =
    slot === "next" ? "current" : slot === "priorCommitment" ? "last" : null;
  if (partner && item.recordId) {
    const related = rows.findIndex(
      (row) => !row[slot] && row[partner]?.recordId === item.recordId,
    );
    if (related !== -1) return related;
  }
  const empty = rows.findIndex((row) => !row[slot]);
  return empty === -1 ? rows.length : empty;
}

function appendOccurrence(
  {
    slot,
    unit,
    item,
  }: { slot: Slot; unit: StatusOverviewUnit; item: StatusOverviewItem },
  {
    groups,
    destinations,
  }: {
    groups: Map<string, Map<string, StatusOverviewLineageRow[]>>;
    destinations: Map<string, string>;
  },
) {
  const historical = slot === "last" || slot === "priorCommitment";
  const destination =
    (historical && item.stableId ? destinations.get(item.stableId) : null) ??
    unit.key;
  const group = groups.get(destination);
  if (!group) return;
  const identity =
    item.stableId ??
    `${unit.key}:${historical ? "prior" : "record"}:${item.recordId ?? item.key}`;
  const matches = group.get(identity) ?? [];
  const index = availableSlot(matches, slot, item);
  const row = matches[index] ?? {
    key: index
      ? `${identity}:${slot}:${item.recordId ?? item.key}:${index}`
      : identity,
    stableId: item.stableId,
    last: null,
    current: null,
    next: null,
    priorCommitment: null,
    answerState: null,
    previousParent: null,
  };
  matches[index] = {
    ...row,
    [slot]: item,
    answerState:
      slot === "priorCommitment" ? (item.verdict ?? null) : row.answerState,
    previousParent:
      slot === "last" && unit.key !== destination
        ? unit.name
        : row.previousParent,
  };
  group.set(identity, matches);
}
