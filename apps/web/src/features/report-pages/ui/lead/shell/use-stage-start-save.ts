import { useState } from "react";

import {
  type KanbanItem,
  ownedStagesForProject,
  type StatusOverviewCreateTarget,
} from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function stageStartStillEligible(
  section: ReadyEditor["draft"]["section"],
  productId: string,
  stages: readonly string[],
): boolean {
  const owned = ownedStagesForProject(section, productId);
  return stages.length > 0 && stages.every((stage) => owned.includes(stage));
}

export function useStageStartSave(
  editor: ReadyEditor,
  target: StatusOverviewCreateTarget | null,
) {
  const [stageError, setStageError] = useState<string | null>(null);
  const section = editor.draft.section;
  const save = (item: KanbanItem, action: (item: KanbanItem) => void) => {
    if (
      target?.stageName &&
      item.parent.kind === "product" &&
      !stageStartStillEligible(section, item.parent.id, item.stageNames)
    ) {
      setStageError(
        "Select currently owned stages. Your input has been retained.",
      );
      return;
    }
    setStageError(null);
    action(item);
  };
  return { stageError, save };
}
