"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useCallback, useState } from "react";

import {
  changedStageSelections,
  createDraftStageMemory,
  type DraftStageMemory,
} from "../draft-stage-memory";
import type { DraftPatch } from "./draft/lead-form-draft-patch";
import type { LeadFormGeneration } from "./lead-form-generation";

// One memory instance per open draft generation. Adjusting state during render
// keyed on the generation keeps the reset out of an effect, while editor
// remounts inside the same generation keep the instance.
export function useDraftStageMemory(
  generation: LeadFormGeneration | null,
): DraftStageMemory {
  const [memory, setMemory] = useState(() => createDraftStageMemory());
  const [stateGeneration, setStateGeneration] = useState(generation);
  if (stateGeneration !== generation) {
    setStateGeneration(generation);
    setMemory(createDraftStageMemory());
  }
  return memory;
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
