import type { ReportSectionReadModel } from "@weeklyreport/shared";

import type { DraftPatch } from "./lead-form/draft/lead-form-draft-patch";

// One record's saved stage selection: the item/risk/decision parent plus the
// stages the lead left selected.
export interface SavedStageSelection {
  readonly productId: string | null | undefined;
  readonly stageNames: readonly string[];
}

export interface PersistedStageRecords {
  readonly items: readonly {
    readonly projectId?: string | null | undefined;
    readonly stageNames: readonly string[];
  }[];
  readonly risks: readonly {
    readonly projectId?: string | null | undefined;
    readonly stageNames: readonly string[];
  }[];
  readonly decisions: readonly {
    readonly productId?: string | null | undefined;
    readonly stageNames: readonly string[];
  }[];
}

// Per-draft memory of the last stage a record save left selected, so the next
// create opens on the same product stage. Seen from the UI as a convenience
// default only: it never overrides a stored selection, an explicit prefill, or
// stage ownership.
export interface DraftStageMemory {
  // Remembered stage for the product: the pending save first, then the persisted
  // one. A pending choice the draft failed to persist is not recalled.
  recall(productId: string | null | undefined): string | undefined;
  // Records stage selections accepted into the local draft, before the save is
  // confirmed. Only a single selected stage is remembered; a deliberate
  // multi-select leaves the previous singleton in place.
  stageChangedSelections(selections: readonly SavedStageSelection[]): void;
  // A persistence attempt failed: unconfirmed choices stop being the default
  // but may still be confirmed by a later successful save.
  noteSaveFailed(): void;
  // Promotes locally saved singletons the server has now persisted.
  confirmPersisted(section: PersistedStageRecords): void;
}

interface PendingStage {
  readonly stageName: string;
  readonly recallable: boolean;
}

function singletonOf(selection: SavedStageSelection): {
  readonly productId: string;
  readonly stageName: string;
} | null {
  const { productId, stageNames } = selection;
  if (productId === null || productId === undefined || productId === "")
    return null;
  if (stageNames.length !== 1) return null;
  const [stageName] = stageNames;
  return stageName === undefined ? null : { productId, stageName };
}

function sameStageSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((stage) => right.includes(stage))
  );
}

function sectionHasSingleton(
  section: PersistedStageRecords,
  productId: string,
  stageName: string,
): boolean {
  const matches = (stageNames: readonly string[]): boolean =>
    stageNames.length === 1 && stageNames[0] === stageName;
  return (
    section.items.some(
      (item) => item.projectId === productId && matches(item.stageNames),
    ) ||
    section.risks.some(
      (risk) => risk.projectId === productId && matches(risk.stageNames),
    ) ||
    section.decisions.some(
      (decision) =>
        decision.productId === productId && matches(decision.stageNames),
    )
  );
}

export function createDraftStageMemory(): DraftStageMemory {
  const persisted = new Map<string, string>();
  const pending = new Map<string, PendingStage>();
  return {
    recall(productId) {
      if (productId === null || productId === undefined || productId === "")
        return undefined;
      const pendingStage = pending.get(productId);
      if (pendingStage?.recallable) return pendingStage.stageName;
      return persisted.get(productId);
    },
    stageChangedSelections(selections) {
      for (const selection of selections) {
        const singleton = singletonOf(selection);
        if (singleton === null) continue;
        pending.set(singleton.productId, {
          stageName: singleton.stageName,
          recallable: true,
        });
      }
    },
    noteSaveFailed() {
      for (const [productId, stage] of pending) {
        if (stage.recallable) {
          pending.set(productId, { ...stage, recallable: false });
        }
      }
    },
    confirmPersisted(section) {
      for (const [productId, stage] of pending) {
        if (!sectionHasSingleton(section, productId, stage.stageName)) continue;
        persisted.set(productId, stage.stageName);
        pending.delete(productId);
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

interface StageSelectionRow extends SavedStageSelection {
  // Draft-only rows may not carry a stored id until the save is echoed.
  readonly id?: string | undefined;
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
    return [{ productId: row.productId, stageNames: row.stageNames }];
  });
}
