import type { ReportSectionReadModel } from "@weeklyreport/shared";

import type { DraftPatch } from "./lead-form/draft/lead-form-draft-patch";

// One record's stage choice made in this draft: the draft row it belongs to,
// the record's parent, and the stages the lead left selected.
export interface SavedStageSelection {
  // The draft row identity. A choice is confirmed only by the save of this
  // exact record, never by another record of the same Product.
  readonly recordId: string;
  readonly productId: string | null | undefined;
  readonly stageNames: readonly string[];
}

// The accepted server section, narrowed to what confirming a choice needs.
interface PersistedStageRecords {
  readonly items: readonly Pick<
    ReportSectionReadModel["items"][number],
    "id" | "projectId" | "stageNames"
  >[];
  readonly risks: readonly Pick<
    ReportSectionReadModel["risks"][number],
    "id" | "projectId" | "stageNames"
  >[];
  readonly decisions: readonly Pick<
    ReportSectionReadModel["decisions"][number],
    "id" | "productId" | "stageNames"
  >[];
}

// This accepted save's draft-row to server-row mapping. A row absent here was
// not part of the save, so it can confirm nobody's pending choice.
interface PersistedRecordIdentity {
  readonly clientId: string;
  readonly serverId: string;
}

// Per-draft memory of the last stage a record save persisted, so the next
// create opens on the same product stage. Seen from the UI as a convenience
// default only: it never overrides a stored selection, an explicit prefill, or
// stage ownership, and it only ever reflects what the server accepted.
export interface DraftStageMemory {
  // Remembered stage for the product, as confirmed by the server. A local
  // choice that has not persisted is never recalled.
  recall(productId: string | null | undefined): string | undefined;
  // Records stage selections accepted into the local draft. Only a single
  // selected stage is remembered; a deliberate multi-select leaves the previous
  // singleton in place.
  stageChangedSelections(selections: readonly SavedStageSelection[]): void;
  // Promotes locally saved singletons the server has now persisted for the very
  // rows that carried them. `identities` maps this save's draft rows to its
  // server rows; a created row additionally matches the section by that id.
  confirmPersisted(
    section: PersistedStageRecords,
    identities?: readonly PersistedRecordIdentity[],
  ): void;
}

interface PendingStage {
  readonly productId: string;
  readonly stageName: string;
}

// The same pending choice, moved from the draft row the save was made for to
// the server row that save created.
interface PendingRekey {
  readonly from: string;
  readonly to: string;
  readonly stage: PendingStage;
}

interface PendingConfirmation {
  readonly recordId: string;
  readonly stage: PendingStage;
}

// What one accepted save does to the pending choices.
interface PendingSettlement {
  readonly confirmed: readonly PendingConfirmation[];
  readonly dropped: readonly string[];
  readonly rekeyed: readonly PendingRekey[];
}

function singletonOf(selection: SavedStageSelection): {
  readonly recordId: string;
  readonly productId: string;
  readonly stageName: string;
} | null {
  const { recordId, productId, stageNames } = selection;
  if (recordId === "") return null;
  if (productId === null || productId === undefined || productId === "")
    return null;
  if (stageNames.length !== 1) return null;
  const [stageName] = stageNames;
  return stageName === undefined ? null : { recordId, productId, stageName };
}

function sameStageSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((stage) => right.includes(stage))
  );
}

interface ConfirmedTarget {
  readonly serverId: string;
  readonly productId: string;
  readonly stageName: string;
}

function recordConfirms(
  record: {
    readonly id?: string | undefined;
    readonly stageNames: readonly string[];
  },
  parentId: string | null | undefined,
  target: ConfirmedTarget,
): boolean {
  return (
    record.id === target.serverId &&
    parentId === target.productId &&
    record.stageNames.length === 1 &&
    record.stageNames[0] === target.stageName
  );
}

function sectionHasSingleton(
  section: PersistedStageRecords,
  target: ConfirmedTarget,
): boolean {
  return (
    section.items.some((item) =>
      recordConfirms(item, item.projectId, target),
    ) ||
    section.risks.some((risk) =>
      recordConfirms(risk, risk.projectId, target),
    ) ||
    section.decisions.some((decision) =>
      recordConfirms(decision, decision.productId, target),
    )
  );
}

// Sorts the pending choices against one accepted save. A choice the server
// stored is confirmed, and a created row's choice moves from its draft id to
// the server row the echo names so the next save can confirm it. A stale entry
// under the draft id is removed when a newer choice already sits under that
// server row; that newer choice itself is left untouched. Anything else stays
// pending.
function settlePendingChoices(
  section: PersistedStageRecords,
  pending: ReadonlyMap<string, PendingStage>,
  serverIdByClientId: ReadonlyMap<string, string>,
): PendingSettlement {
  const confirmed: PendingConfirmation[] = [];
  const dropped: string[] = [];
  const rekeyed: PendingRekey[] = [];
  for (const [recordId, stage] of pending) {
    const serverId = serverIdByClientId.get(recordId);
    const target: ConfirmedTarget = {
      serverId: serverId ?? recordId,
      productId: stage.productId,
      stageName: stage.stageName,
    };
    if (sectionHasSingleton(section, target)) {
      confirmed.push({ recordId, stage });
      continue;
    }
    // Existing rows are already keyed by their server id.
    if (serverId === undefined || serverId === recordId) continue;
    // A newer choice already lives under the server row: remove only the stale
    // draft-id entry.
    if (pending.has(serverId)) {
      dropped.push(recordId);
      continue;
    }
    rekeyed.push({ from: recordId, to: serverId, stage });
  }
  return { confirmed, dropped, rekeyed };
}

export function createDraftStageMemory(): DraftStageMemory {
  const persisted = new Map<string, string>();
  // Keyed by the draft row, so an unrelated record's save cannot confirm it.
  const pending = new Map<string, PendingStage>();
  return {
    recall(productId) {
      if (productId === null || productId === undefined || productId === "")
        return undefined;
      return persisted.get(productId);
    },
    stageChangedSelections(selections) {
      for (const selection of selections) {
        const singleton = singletonOf(selection);
        if (singleton === null) {
          // The row's latest choice cannot be remembered (several, no, or
          // product-less stages), and an in-flight save of the previous
          // singleton must not confirm a choice the lead has abandoned.
          pending.delete(selection.recordId);
          continue;
        }
        // The latest choice for that row is the one a save can confirm.
        pending.set(singleton.recordId, {
          productId: singleton.productId,
          stageName: singleton.stageName,
        });
      }
    },
    confirmPersisted(section, identities = []) {
      if (pending.size === 0) return;
      const settlement = settlePendingChoices(
        section,
        pending,
        new Map(
          identities.map((identity) => [identity.clientId, identity.serverId]),
        ),
      );
      for (const { recordId, stage } of settlement.confirmed) {
        persisted.set(stage.productId, stage.stageName);
        pending.delete(recordId);
      }
      for (const recordId of settlement.dropped) pending.delete(recordId);
      // The settlement keeps the three groups disjoint, so a re-keyed choice is
      // always still pending and travels with the re-key.
      for (const { from, to, stage } of settlement.rekeyed) {
        pending.delete(from);
        pending.set(to, stage);
      }
    },
  };
}

const productIdOfItem = (
  item: ReportSectionReadModel["items"][number],
): string | null => item.projectId ?? null;
const productIdOfRisk = (
  risk: ReportSectionReadModel["risks"][number],
): string | null => risk.projectId ?? null;
const productIdOfDecision = (
  decision: ReportSectionReadModel["decisions"][number],
): string | null => decision.productId ?? null;

// Every changed record selection a draft patch applies, so the memory only sees
// the saves the lead actually made. Order is not a choice, so reordered stage
// arrays are unchanged; status/placement patches carry no selection change.
export function changedStageSelections(
  previous: ReportSectionReadModel | null,
  patch: DraftPatch,
): readonly SavedStageSelection[] {
  if (previous === null) return [];
  switch (patch.kind) {
    case "week-items": {
      const previousItems = previous.items.filter(
        (item) => item.type === patch.week,
      );
      return changedSelections(
        previousItems.map((item) => ({
          id: item.id,
          productId: productIdOfItem(item),
          stageNames: item.stageNames,
        })),
        patch.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          stageNames: item.stageNames,
        })),
      );
    }
    case "risks":
      return changedSelections(
        previous.risks.map((risk) => ({
          id: risk.id,
          productId: productIdOfRisk(risk),
          stageNames: risk.stageNames,
        })),
        patch.risks.map((risk) => ({
          id: risk.id,
          productId: risk.productId,
          stageNames: risk.stageNames,
        })),
      );
    case "decisions":
      return changedSelections(
        previous.decisions.map((decision) => ({
          id: decision.id,
          productId: productIdOfDecision(decision),
          stageNames: decision.stageNames,
        })),
        patch.decisions.map((decision) => ({
          id: decision.id,
          productId: decision.productId,
          stageNames: decision.stageNames,
        })),
      );
    default:
      return [];
  }
}

interface StageSelectionRow {
  // Draft-only rows may not carry a stored id until the save is echoed.
  readonly id?: string | undefined;
  readonly productId: string | null | undefined;
  readonly stageNames: readonly string[];
}

function changedSelections(
  previous: readonly StageSelectionRow[],
  next: readonly StageSelectionRow[],
): readonly SavedStageSelection[] {
  const previousById = new Map(
    previous.flatMap((row) => (row.id === undefined ? [] : [[row.id, row]])),
  );
  return next.flatMap((row) => {
    const before = row.id === undefined ? undefined : previousById.get(row.id);
    if (
      before !== undefined &&
      before.productId === row.productId &&
      sameStageSet(before.stageNames, row.stageNames)
    ) {
      return [];
    }
    if (row.id === undefined) return [];
    return [
      {
        recordId: row.id,
        productId: row.productId,
        stageNames: row.stageNames,
      },
    ];
  });
}
