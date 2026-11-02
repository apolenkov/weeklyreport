import type { ItemWorkflowStatus } from "@weeklyreport/shared";

import type {
  ItemStatusInput,
  StatusOverviewItem,
} from "../../../../report-sections";
import { ownedStagesForProject } from "../../../../report-sections";
import { saveOverviewStatus } from "./overview-status-save";
import { useEditorSettle } from "./use-editor-settle";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
const UNAVAILABLE = "This update is no longer available. Reload the report.";

export function useOverviewStatusSave(editor: ReadyEditor | null) {
  const { until, latest } = useEditorSettle(editor);
  return async (
    item: StatusOverviewItem,
    status: ItemWorkflowStatus,
    input: ItemStatusInput = {},
  ): Promise<string | null> => {
    const requested = latest.current;
    if (!requested?.generation) return UNAVAILABLE;
    const ready = requested.outcomes.pending
      ? await until((candidate) => !candidate.outcomes.pending)
      : requested;
    if (!ready) return "Wait for the current update to finish, then try again.";
    if (
      ready.generation !== requested.generation ||
      ready.draft.section.authorId !== requested.draft.section.authorId
    )
      return "The report context changed. Reload the report before trying again.";
    const source = ready.draft.section.items.find((row) =>
      item.stableId !== null
        ? row.stableId === item.stableId
        : item.recordId !== null && row.id === item.recordId,
    );
    if (!source?.id) return UNAVAILABLE;
    return saveOverviewStatus(ready, {
      item: { ...item, recordId: source.id },
      status,
      input,
    });
  };
}

export function useOverviewStagesSave(editor: ReadyEditor | null) {
  const { until, latest } = useEditorSettle(editor);
  return async (
    item: StatusOverviewItem,
    stageNames: readonly string[],
  ): Promise<string | null> => {
    const requested = latest.current;
    if (!requested?.generation) return UNAVAILABLE;
    const ready = requested.outcomes.pending
      ? await until((candidate) => !candidate.outcomes.pending)
      : requested;
    if (!ready) return "Wait for the current update to finish, then try again.";
    if (
      ready.generation !== requested.generation ||
      ready.draft.section.authorId !== requested.draft.section.authorId
    )
      return "The report context changed. Reload the report before trying again.";
    if (ready.view.viewModel.isReadOnly)
      return "This report is read-only. Reload the report.";
    const source = ready.draft.section.items.find((row) =>
      item.stableId !== null
        ? row.stableId === item.stableId
        : item.recordId !== null && row.id === item.recordId,
    );
    if (
      !source?.id ||
      !source.projectId ||
      source.resolution != null ||
      ready.draft.section.status !== "draft" ||
      source.type !== item.source ||
      item.needsConfirmation ||
      item.editTarget?.focusNextStep ||
      !item.editTarget
    )
      return UNAVAILABLE;
    const owned = ownedStagesForProject(ready.draft.section, source.projectId);
    if (
      stageNames.length === 0 ||
      stageNames.some(
        (name) => !owned.includes(name) && !source.stageNames.includes(name),
      )
    )
      return "Choose at least one owned stage.";
    ready.draft.apply({
      kind: "item-patch",
      itemId: source.id,
      patch: { stageNames: [...stageNames] },
    });
    return null;
  };
}
