"use client";

import type { RefObject } from "react";
import { createContext } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import type { ItemEditDraftStore } from "./item-edit-draft-store";

export const OverviewUnitCollapsed = createContext(false);
export const OverviewVisibleWeek = createContext<string | null>(null);

export interface ActiveRecordEditor {
  readonly id: string;
  readonly stableId?: string | null;
  readonly source: StatusOverviewItem["source"];
  readonly store: ItemEditDraftStore;
  readonly failed?: boolean;
  readonly published?: boolean;
  readonly detailsOpen?: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly close: () => void;
  readonly discard?: () => void;
  readonly leave?: () => void;
  readonly save: () => void;
  readonly details: (origin: HTMLElement) => void;
  readonly remove?: (step: boolean) => void;
  readonly move?: () => void;
}
export const OverviewRecordContext = createContext<{
  readonly onReasonDraft?: (
    id: string,
    issue: { label: string; overviewFocus: string } | null,
  ) => void;
  readonly active: ActiveRecordEditor | null;
  readonly submitted: boolean;
  readonly deleteRecord?:
    ((kind: "risk" | "decision", stableId: string) => void) | undefined;
}>({ active: null, submitted: false });

export interface PanelProps {
  readonly item: StatusOverviewItem;
  readonly editor: ActiveRecordEditor;
  readonly owned: readonly string[];
  readonly trigger: RefObject<HTMLButtonElement | null>;
  readonly discussion: boolean;
  readonly openDiscussion: () => void;
  readonly occupied: boolean;
  readonly published: boolean;
  readonly moveReason: string | undefined;
}
