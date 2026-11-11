import type { DraftRecordSaveState } from "../model/types";

const LABELS: Record<DraftRecordSaveState, string> = {
  local: "Not saved, unfinished",
  pending: "Save pending, unfinished",
  error: "Save failed, unfinished",
  uncertain: "Save unconfirmed, unfinished",
  saved: "Saved, unfinished",
};

export function unfinishedRecordLabel(
  state: DraftRecordSaveState | undefined,
): string {
  return state === undefined ? "Unfinished" : LABELS[state];
}
