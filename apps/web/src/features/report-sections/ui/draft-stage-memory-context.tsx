"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import type { DraftStageMemory } from "../model/draft-stage-memory";
import {
  createDraftStageMemoryScope,
  DraftStageMemoryScopeContext,
} from "../model/lead-form/draft-stage-memory-scope";

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

// The report-level owner of the draft memories: every editor instance for the
// same draft generation resolves the same memory, so switching the report view
// (which remounts the form) does not forget the open draft's default. A stable
// mutable store is created once here; the caller keys it on the report id so
// another report starts empty.
export function DraftStageMemoryScopeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [scope] = useState(createDraftStageMemoryScope);
  return (
    <DraftStageMemoryScopeContext.Provider value={scope}>
      {children}
    </DraftStageMemoryScopeContext.Provider>
  );
}
