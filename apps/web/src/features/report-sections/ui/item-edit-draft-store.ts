import type { SetStateAction } from "react";

import type {
  ParentActivityOption,
  RecordParent,
} from "../model/record-parent";
import { resolveRecordParent } from "../model/record-parent";
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
  const state: { snapshot: ItemEditDraftFields } = {
    snapshot: {
      text: initial.text,
      nextStepText: initial.nextStepText ?? "",
      status: initial.status,
      pausedReason: args.item?.pausedReason ?? "",
      parent: resolveRecordParent(
        initial,
        { activityId: isCreate ? args.defaultActivityId : undefined },
        args.activities,
      ),
      priorityRank: args.item?.priorityRank ?? null,
      stageNames: [...(args.item?.stageNames ?? [])],
    },
  };
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
    isCreate,
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
