"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { DraftStageMemory } from "../model/draft-stage-memory";

// One open lead-section draft owns one memory instance. Record dialogs read it
// through this context so a default survives their own remounts but cannot leak
// into another draft, report, or page without a provider.
const DraftStageMemoryContext = createContext<DraftStageMemory | null>(null);

export function DraftStageMemoryProvider({
  memory,
  children,
}: {
  readonly memory: DraftStageMemory | null;
  readonly children: ReactNode;
}) {
  return (
    <DraftStageMemoryContext.Provider value={memory}>
      {children}
    </DraftStageMemoryContext.Provider>
  );
}

export function useDraftStageMemory(): DraftStageMemory | null {
  return useContext(DraftStageMemoryContext);
}
