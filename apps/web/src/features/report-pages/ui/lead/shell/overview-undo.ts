import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { sectionToDraftPayload } from "../../../../report-sections";
export interface UndoTarget {
  kind: "item" | "risk" | "decision";
  stableId: string;
}
export function undoRefusal(state: {
  saving: boolean;
  editing: boolean;
  reply: boolean;
  changed: boolean;
}) {
  if (state.saving) return "Still saving. Try Undo in a moment.";
  if (state.editing)
    return "Can’t undo while a form is open. Save or cancel it first.";
  if (state.reply)
    return "Can’t undo while its discussion has an unsent reply. Send or clear it first.";
  if (state.changed) return "Can’t undo: this work changed after that.";
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
