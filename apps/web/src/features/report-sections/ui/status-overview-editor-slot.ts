import type { ReactNode } from "react";

import type { StatusOverviewItem } from "../model/status-overview";

export interface StatusOverviewEditorSlot {
  readonly unitKey: string;
  readonly source: "previous" | "current" | "next";
  readonly recordId: string | null;
  readonly stableId?: string | null | undefined;
  readonly content: ReactNode;
}

export function editorSlotMatchesItem(
  editorSlot: StatusOverviewEditorSlot | undefined,
  item: StatusOverviewItem,
): boolean {
  if (editorSlot?.source !== item.source) return false;
  return editorSlot.stableId
    ? editorSlot.stableId === item.stableId
    : editorSlot.recordId === item.recordId;
}

export function editorLaneClass(
  matchesEditor: boolean,
  hasMatchedEditor: boolean,
  idleClass: string,
): string {
  if (!hasMatchedEditor) return idleClass;
  return matchesEditor ? "block md:col-span-3" : "hidden";
}

export function idleTimelineLaneClass(isActive: boolean): string {
  return isActive ? "block" : "hidden md:block";
}
