"use client";

import { createContext } from "react";

import {
  createDraftStageMemory,
  type DraftStageMemory,
} from "../draft-stage-memory";
import type { LeadFormGeneration } from "./lead-form-generation";

// One open lead report owns one memory per draft generation. The report level
// owns the instances (not the editor roots), so switching the report view
// remounts the form without forgetting the open draft's default, while a draft
// or report change resolves a fresh instance.
export interface DraftStageMemoryScope {
  read(generation: LeadFormGeneration | null): DraftStageMemory;
}

export function createDraftStageMemoryScope(): DraftStageMemoryScope {
  const memories = new Map<LeadFormGeneration | null, DraftStageMemory>();
  return {
    read(generation) {
      const existing = memories.get(generation);
      if (existing !== undefined) return existing;
      const memory = createDraftStageMemory();
      memories.set(generation, memory);
      return memory;
    },
  };
}

// Read by the draft hooks; the report-level provider owns the scope instance.
export const DraftStageMemoryScopeContext =
  createContext<DraftStageMemoryScope | null>(null);
