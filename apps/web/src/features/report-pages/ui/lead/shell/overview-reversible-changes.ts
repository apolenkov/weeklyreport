import {
  buildMoveItemPatch,
  type DraftPatch,
  type StatusOverviewItem,
} from "../../../../report-sections";
import type { ReadyEditor } from "./use-overview-controller";
import type { OverviewUndoWrite } from "./use-overview-undo";

export function itemChange(
  editor: ReadyEditor,
  item: StatusOverviewItem,
  action: "delete" | "step" | "move",
): OverviewUndoWrite | null {
  const { section } = editor.draft;
  const row = section.items.find((value) => value.id === item.recordId);
  if (
    !item.stableId ||
    !row?.id ||
    row.stableId !== item.stableId ||
    !item.editTarget ||
    row.resolution
  )
    return null;
  const target = { kind: "item" as const, stableId: item.stableId };
  const week = row.type;
  const latestRow = (ready: ReadyEditor) =>
    ready.draft.section.items.find(
      (other) => other.stableId === row.stableId && other.type === week,
    );
  if (action === "move") {
    const to = week === "current" ? "next" : "current";
    const patch = buildMoveItemPatch(section, row.id, to);
    if (!patch || item.editTarget.focusNextStep) return null;
    return {
      section,target,
      patch,
      message: to === "next" ? "Moved to next week" : "Moved to this week",
      reverse: (ready) => {
        const moved = ready.draft.section.items.find(
          (value) => value.stableId === row.stableId && value.type === to,
        );
        if (
          !moved?.id ||
          !buildMoveItemPatch(ready.draft.section, moved.id, week)
        )
          return null;
        return {
          kind: "item-patch",
          itemId: moved.id,
          patch: { type: week, carriedOver: row.carriedOver },
        };
      },
    };
  }
  if (action === "step") {
    if (!row.nextStepText) return null;
    return {
      section,target,
      patch: {
        kind: "item-patch",
        itemId: row.id,
        patch: { nextStepText: null },
      },
      message: "Next step deleted",
      reverse: (ready) => {
        const parent = latestRow(ready);
        return parent?.id && !parent.nextStepText
          ? {
              kind: "item-patch",
              itemId: parent.id,
              patch: { nextStepText: row.nextStepText },
            }
          : null;
      },
    };
  }
  const list = (ready: ReadyEditor) =>
    week === "current"
      ? ready.view.viewModel.ownCurrentWeekItems
      : ready.view.viewModel.ownNextWeekItems;
  const deleted = list(editor).find((value) => value.id === row.id);
  if (!deleted) return null;
  return {
    section,target,
    patch: {
      kind: "week-items",
      week,
      items: list(editor).filter((value) => value.id !== row.id),
    },
    message: "Entry deleted",
    reverse: (ready) =>
      latestRow(ready)
        ? null
        : { kind: "week-items", week, items: [...list(ready), deleted] },
  };
}
export function unitRecordDeletion(
  editor: ReadyEditor,
  kind: "risk" | "decision",
  stableId: string,
): OverviewUndoWrite | null {
  const view = editor.view.viewModel;
  const reportSectionId = editor.draft.section.reportSectionId;
  const entry =
    kind === "risk"
      ? view.ownRisks.find((row) => row.stableId === stableId)
      : view.ownDecisions.find((row) => row.stableId === stableId);
  if (!entry || entry.foreign) return null;
  const record =
    "severity" in entry
      ? { kind: "risk" as const, entry }
      : { kind: "decision" as const, entry };
  const patch: DraftPatch = {
    kind: "discard-created-record",
    reportSectionId,
    record,
  };
  return {
    section:editor.draft.section,target: { kind, stableId },
    patch,
    message: kind === "risk" ? "Risk deleted" : "Decision deleted",
    reverse: () => ({ kind: "create-record", reportSectionId, record }),
  };
}
