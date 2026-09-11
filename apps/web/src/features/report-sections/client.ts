"use client";

export type {
  AutosaveSaveReceipt,
  AutosaveSnapshot,
  AutosaveState,
  SavedDraftRecordIdentity,
} from "./model/autosave/autosave-types";
export type { LeadFormWritePort } from "./model/lead-form/lead-form-write-port";
export { isLeadFormWriteConflict } from "./model/lead-form/lead-form-write-port";
export { useLeadFormWritePort } from "./model/lead-form/lead-form-write-port.trpc-adapter";
export { useGenerationState } from "./model/lead-form/use-generation-state";
export { useLeadFormDraft } from "./model/lead-form/use-lead-form-draft";
export type {
  LeadFormOutcomeActions,
  ResolvePlanCommandInput,
  RestorePlanCommandInput,
} from "./model/lead-form/use-lead-form-outcome-coordinator";
export type { QuickAddItem } from "./model/lead-form/use-lead-form-quick-add";
export { useLeadFormQuickAdd } from "./model/lead-form/use-lead-form-quick-add";
export { useLeadFormRevoke } from "./model/lead-form/use-lead-form-revoke";
export type { DraftSaveContent } from "./model/lead-section-draft-payload";
export { useStatusRiskSync } from "./model/status-risk/use-status-risk";
export type { RecordVisibility } from "./model/visibility/use-record-visibility";
export { useRecordVisibility } from "./model/visibility/use-record-visibility";
export { useInlineEditUnloadGuard } from "./ui/use-inline-edit-unload-guard";
