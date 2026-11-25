import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { sectionToDraftPayload } from "../../../../report-sections";
export interface UndoTarget {
  kind: "item" | "risk" | "decision";
  stableId: string;
}
export function undoRefusal(state: {
  deletion?: boolean | undefined;
  ownEditor?: boolean;
  occupied?: "current" | "next" | undefined;
  saving: boolean;
  editing: boolean;
  reply: boolean;
  changed: boolean;
}) {
  if (state.saving) return "Still saving. Try Undo in a moment.";
  const wording = state.deletion === false ? itemRefusals : deletedRefusals;
  if (state.editing)
    return state.ownEditor ? wording.editing : deletedRefusals.editing;
  if (state.reply) return wording.reply;
  if (state.occupied)
    return `Can’t undo: ${state.occupied === "current" ? "This week" : "Next week"} already has this item.`;
  if (state.changed) return wording.changed;
  return null;
}
export function workSignature(
  section: ReportSectionReadModel,
  target: UndoTarget,
) {
  const payload = sectionToDraftPayload(section);
  const rows =
    target.kind === "item"
      ? payload.items
      : target.kind === "risk"
        ? payload.risks
        : payload.decisions;
  const fields = rows
    .filter((row) => row.stableId === target.stableId)
    .map((row) => ({ ...row, id: undefined }));
  const outcomes =
    target.kind === "item"
      ? section.items
          .filter((row) => row.stableId === target.stableId)
          .map((row) => [row.resolution ?? null, row.outcomeHistory ?? []])
      : [];
  return JSON.stringify([fields, outcomes]);
}

const deletedRefusals = {
  editing: "Can’t undo while a form is open. Save or cancel it first.",
  reply:
    "Can’t undo while its discussion has an unsent reply. Send or clear it first.",
  changed: "Can’t undo: this work changed after that.",
};
const itemRefusals = {
  editing: "Can’t undo while this item is being edited. Save or cancel first.",
  reply:
    "Can’t undo while a reply is being written in its discussion. Send or clear it first.",
  changed: "Can’t undo: this item changed after that.",
};
