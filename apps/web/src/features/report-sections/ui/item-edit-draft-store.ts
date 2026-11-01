import type { SetStateAction } from "react";

import type { DraftStageMemory } from "../model/draft-stage-memory";
import type {
  ParentActivityOption,
  RecordParent,
} from "../model/record-parent";
import { resolveRecordParent } from "../model/record-parent";
import { resolveInitialStageNames } from "../model/stage-ownership";
import type { ItemStatus, KanbanItem, Product } from "../model/types";
import { resolveInitialItem } from "./item-edit-dialog-helpers";

export interface ItemEditDraftSeed {
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly week: "current" | "next";
  readonly currentUserName?: string | undefined;
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  // Open-draft stage memory and the product stage ownership it is scoped by.
  readonly stageMemory?: DraftStageMemory | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
}

interface ItemEditDraftFields {
  readonly text: string;
  readonly nextStepText: string;
  readonly status: ItemStatus;
  readonly pausedReason: string;
  readonly parent: RecordParent;
  readonly priorityRank: number | null;
  readonly stageNames: string[];
}

// Owned by one open composer, never shared between users or report sessions.
// Keeping it above a timeline row preserves input when save echoes re-key rows.
export function createItemEditDraftStore(args: ItemEditDraftSeed) {
  const isCreate = args.item === null;
  const initial = resolveInitialItem({
    item: args.item,
    week: args.week,
    seedProduct: isCreate
      ? args.products.find((product) => product.id === args.defaultProductId)
      : undefined,
    currentUserName: args.currentUserName,
  });
  const parent = resolveRecordParent(
    initial,
    {
      activityId: isCreate ? args.defaultActivityId : undefined,
      productId: isCreate ? args.defaultProductId : undefined,
    },
    args.activities,
    args.products,
  );
  const productId = parent.kind === "product" ? parent.id : undefined;
  const stageNames = resolveInitialStageNames({
    isCreate,
    storedStageNames: args.item?.stageNames,
    rememberedStageName:
      productId === undefined ? undefined : args.stageMemory?.recall(productId),
    availableStages:
      productId === undefined ? [] : (args.stagesForProduct?.(productId) ?? []),
  });
  const state: { snapshot: ItemEditDraftFields } = {
    snapshot: {
      text: initial.text,
      nextStepText: initial.nextStepText ?? "",
      status: initial.status,
      pausedReason: args.item?.pausedReason ?? "",
      parent,
      priorityRank: args.item?.priorityRank ?? null,
      stageNames: [...stageNames],
    },
  };
  const baseline = state.snapshot;
  const listeners = new Set<() => void>();
  const update = <Key extends keyof ItemEditDraftFields>(
    key: Key,
    value: SetStateAction<ItemEditDraftFields[Key]>,
  ): void => {
    const previous = state.snapshot;
    const next = typeof value === "function" ? value(previous[key]) : value;
    if (Object.is(next, previous[key])) return;
    state.snapshot = { ...previous, [key]: next };
    listeners.forEach((listener) => listener());
  };
  return {
    initial,
    baseline,
    isCreate,
    // Any field change (not only text) makes the draft worth confirming.
    isDirty: () => JSON.stringify(state.snapshot) !== JSON.stringify(baseline),
    getSnapshot: () => state.snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setters: {
      setText: (value: SetStateAction<string>) => update("text", value),
      setNextStepText: (value: SetStateAction<string>) =>
        update("nextStepText", value),
      setStatus: (value: SetStateAction<ItemStatus>) => update("status", value),
      setPausedReason: (value: SetStateAction<string>) =>
        update("pausedReason", value),
      setParent: (value: SetStateAction<RecordParent>) =>
        update("parent", value),
      setPriorityRank: (value: SetStateAction<number | null>) =>
        update("priorityRank", value),
      setStageNames: (value: SetStateAction<string[]>) =>
        update("stageNames", value),
    },
  };
}

export type ItemEditDraftStore = ReturnType<typeof createItemEditDraftStore>;
