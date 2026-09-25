import type { ReactNode } from "react";

export interface StatusOverviewEditorSlot {
  readonly mode: "create" | "edit" | "resolve";
  readonly unitKey: string;
  readonly source: "previous" | "current" | "next";
  readonly recordId: string | null;
  readonly stableId?: string | null | undefined;
  readonly content: ReactNode;
}
