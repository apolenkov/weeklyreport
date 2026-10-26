import type { AutosaveSnapshot } from "../../../../report-sections/client";

export function formatAutosaveLabel(autosave: AutosaveSnapshot): string {
  if (autosave.state === "saving") return "Saving…";
  if (autosave.state === "pending") return "Pending…";
  if (autosave.state === "error") return "Save failed";
  if (autosave.state === "saved" && autosave.lastSavedAt) {
    return `Saved ${autosave.lastSavedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return "Autosaved";
}
