import type { ReactNode } from "react";

/** Risks and decisions belong to a reporting unit without an item week lane. */
export interface StatusOverviewRecordSlot {
  readonly unitKey: string;
  readonly content: ReactNode;
}

export interface StatusOverviewEditorSlot {
  readonly mode: "create" | "edit" | "resolve";
  readonly unitKey: string;
  readonly source: "previous" | "current" | "next";
  readonly recordId: string | null;
  readonly stableId?: string | null | undefined;
  readonly content: ReactNode;
}
