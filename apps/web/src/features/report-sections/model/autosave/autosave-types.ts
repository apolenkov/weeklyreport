import type { ReportSectionReadModel } from "@customreport/shared";

import type { LeadFormGeneration } from "../lead-form/lead-form-generation";
import type { LeadFormWritePort } from "../lead-form/lead-form-write-port";
import type { DraftSaveContent } from "../lead-section-draft-payload";

export type { DraftSaveContent } from "../lead-section-draft-payload";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

// One save attempt: the comparison key it was scheduled under, the content to
// persist, and the optimistic-lock version plus activation it belongs to.
export interface AutosaveRequest {
  readonly key: string;
  readonly payload: DraftSaveContent;
  readonly version: number;
  readonly generation: symbol;
}

export interface AutosaveSnapshot {
  readonly state: AutosaveState;
  readonly lastSavedAt: Date | null;
  readonly dirty: boolean;
  /** Exact payload/baseline equality, independent of whether saves are enabled. */
  readonly currentPayloadMatchesSavedBaseline: boolean;
  readonly isInFlight: boolean;
  // Cancel the debounce timer and trigger an immediate save.
  readonly forceSave: () => Promise<void>;
}

export interface SavedDraftRecordIdentity {
  readonly clientId: string;
  readonly serverId: string;
  readonly stableId: string | null;
  /** Exact next-step value carried by the persisted item payload, when present. */
  readonly persistedNextStepText?: string | null | undefined;
}

export interface AutosaveSaveReceipt {
  readonly sequence: number;
  /** Unique to one report-section editor activation. */
  readonly scope?: string | undefined;
  readonly generation: LeadFormGeneration;
  readonly reportSectionId: string;
  readonly version: number;
  readonly itemIdentities: readonly SavedDraftRecordIdentity[];
}

// Internal write-coordinator controls. The public Lead Form exposes only the
// snapshot above; authoritative non-autosave commands use these controls to
// replace the saved baseline without scheduling a redundant draft save.
export interface AutosaveController extends AutosaveSnapshot {
  readonly primeBaseline: (savedKey: string) => void;
  readonly adoptBaseline: (savedKey: string, source: "read" | "write") => void;
}

export interface UseLeadFormAutosaveArgs {
  readonly writePort: LeadFormWritePort;
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
  // Reconcile confirmed identities in both the visible draft and queued write.
  readonly onSaved?: (
    section: ReportSectionReadModel,
    payload: DraftSaveContent,
    queuedPayload: DraftSaveContent | null,
  ) => SavedDraftReconciliation;
  // Conflict handler lets the caller refetch and suppress the generic toast.
  readonly onConflict?: () => void;
  // Partially typed rows the payload cannot carry yet. They arm the unload
  // guard without scheduling a save, because that save would send the same
  // payload and mint a new version for nothing.
  readonly localOnlyRows?: number;
}

interface SavedDraftReconciliation {
  readonly savedKey: string;
  readonly queuedPayload: DraftSaveContent | null;
}
