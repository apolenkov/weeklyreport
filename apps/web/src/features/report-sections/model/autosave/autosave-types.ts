import type { ReportSectionReadModel } from "@customreport/shared";

import type { DraftSaveContent } from "../lead-section-draft-payload";

export type { DraftSaveContent } from "../lead-section-draft-payload";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveSnapshot {
  readonly state: AutosaveState;
  readonly lastSavedAt: Date | null;
  readonly dirty: boolean;
  readonly isInFlight: boolean;
  // Cancel the debounce timer and trigger an immediate save.
  readonly forceSave: () => Promise<void>;
}

export interface UseLeadFormAutosaveArgs {
  readonly reportSectionId: string | null;
  readonly payload: DraftSaveContent | null;
  readonly enabled: boolean;
  readonly debounceMs?: number;
  // An exact baseline key keeps a fresh server load clean until the user edits;
  // callers own stable serialization.
  readonly initialSavedKey?: string | null;
  // Next save compares against this revision; refetches re-sync the live value.
  readonly version: number;
  // Propagate each server-confirmed version so submit/fillFrom use the current lock.
  readonly onVersionChange: (version: number) => void;
  // Reports the server-confirmed section and persisted payload.
  readonly onSaved?: (
    section: ReportSectionReadModel,
    payload: DraftSaveContent,
  ) => void;
  // Conflict handler lets the caller refetch and suppress the generic toast.
  readonly onConflict?: () => void;
}
