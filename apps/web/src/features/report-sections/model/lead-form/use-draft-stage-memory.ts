"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useCallback, useContext, useState } from "react";

import {
  changedStageSelections,
  createDraftStageMemory,
  type DraftStageMemory,
} from "../draft-stage-memory";
import type { DraftPatch } from "./draft/lead-form-draft-patch";
import { DraftStageMemoryScopeContext } from "./draft-stage-memory-scope";
import type { LeadFormGeneration } from "./lead-form-generation";

// The open draft's memory instance. A report-level scope owns it, so remounting
// the form for another view keeps it; without a scope (a record excerpt or a
// direct draft hook in tests) one instance per generation is kept locally.
export function useLeadFormStageMemory(
  generation: LeadFormGeneration | null,
): DraftStageMemory {
  const scope = useContext(DraftStageMemoryScopeContext);
  // The store is a mutable object, not rendered state: the stable instance is
  // the point. It is replaced only when the draft generation changes, and
  // adjusting state during render keeps that reset out of an effect.
  const [state, setState] = useState(() => ({
    generation,
    memory: createDraftStageMemory(),
  }));
  if (state.generation !== generation) {
    setState({ generation, memory: createDraftStageMemory() });
  }
  return scope === null ? state.memory : scope.read(generation);
}

// Every record save enters the draft as a patch; remembering the changed stage
// selections at this single seam covers Item, Risk and Decision saves from any
// surface and keeps Cancel out of the memory.
export function useStageMemoryApply(args: {
  readonly apply: (patch: DraftPatch) => void;
  readonly draftSection: ReportSectionReadModel | null;
  readonly stageMemory: DraftStageMemory;
}): (patch: DraftPatch) => void {
  const { apply, draftSection, stageMemory } = args;
  return useCallback(
    (patch: DraftPatch) => {
      if (draftSection !== null) {
        stageMemory.stageChangedSelections(
          changedStageSelections(draftSection, patch),
        );
      }
      apply(patch);
    },
    [apply, draftSection, stageMemory],
  );
}
