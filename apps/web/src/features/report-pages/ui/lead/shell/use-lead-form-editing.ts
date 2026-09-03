"use client";

import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";
import { useState } from "react";

import type { CrossAuthorRow } from "../../../../report-sections";
import type { LeadFormGeneration } from "../../../../report-sections";
import type { DraftSaveContent } from "../../../../report-sections/client";
import type { LeadFormWritePort } from "../../../../report-sections/client";
import { useLeadFormDraft } from "../../../../report-sections/client";
import { useLeadFormAddSignals } from "../chrome/use-lead-form-add-signals";
import { useLeadFormChrome } from "../chrome/use-lead-form-chrome";
import { useLeadFormWriteActions } from "../chrome/use-lead-form-write-actions";

interface LeadFormEditingData {
  readonly byPeriodData:
    | { readonly section: ReportSectionReadModel; readonly readOnly: boolean }
    | undefined;
  readonly sectionIdForActions: string | null;
  readonly refetchSection: () => Promise<unknown>;
  readonly crossAuthors: readonly CrossAuthorRow[];
  readonly isEveryone: boolean;
  readonly activeReportId: string | null;
  readonly historyData: readonly MyHistoryEntry[] | undefined;
}

interface UseLeadFormEditingArgs {
  readonly generation: LeadFormGeneration | null;
  readonly pinnedReportId: string | undefined;
  readonly data: LeadFormEditingData;
  readonly writePort: LeadFormWritePort;
}

// Null-traffic own stages auto-promote to On Track at submit (warned first).
// stageStatuses is own-only, so null means genuinely unset; warning and
// coercion share this count so they cannot disagree.
function countUnsetOwnStages(payload: DraftSaveContent | null): number {
  return (payload?.stageStatuses ?? []).filter(
    (status) => status.status == null,
  ).length;
}

// Draft engine, add-signals, write-action dialogs and page chrome, in the
// order LeadForm called them — the hook count must not drift across renders.
export function useLeadFormEditing(args: UseLeadFormEditingArgs) {
  const { generation, pinnedReportId, data, writePort } = args;
  const draft = useLeadFormDraft({
    generation,
    serverSection: data.byPeriodData?.section,
    sectionIdForActions: data.sectionIdForActions,
    serverReadOnly: data.byPeriodData ? data.byPeriodData.readOnly : true,
    refetchSection: data.refetchSection,
    crossAuthors: data.crossAuthors,
    isEveryone: data.isEveryone,
    writePort,
  });
  const addSignals = useLeadFormAddSignals();
  // Draft dialog lifecycle: submit-confirm, revoke, reopen, fill-from. Calls
  // the draft module's submit and reads its readiness.
  const writeActions = useLeadFormWriteActions({
    generation: draft.generation,
    sectionIdForActions: data.sectionIdForActions,
    autosaveDirty: draft.autosave.dirty,
    submitReadiness: draft.submitReadiness,
    submit: draft.submit,
    version: draft.version,
    onRevoked: draft.markUnsubmitted,
    onConflict: draft.reloadAfterConflict,
    writePort,
  });
  // Each toggle flips groupExpanded; AccordionSection mirrors it into local
  // state.
  const [groupExpanded, setGroupExpanded] = useState(true);
  // Page chrome (document title + archived-period auto-expand); only the
  // archive state returns.
  const chrome = useLeadFormChrome({
    pinnedReportId,
    activeReportId: data.activeReportId,
    byPeriodData: data.byPeriodData,
    history: data.historyData,
  });
  return {
    draft,
    addSignals,
    writeActions,
    unsetOwnStageCount: countUnsetOwnStages(draft.draftPayload),
    groupExpanded,
    setGroupExpanded,
    isSubmitted: draft.isSubmitted,
    selectedPeriodId: chrome.selectedPeriodId,
    showArchivePeriods: chrome.showArchivePeriods,
    setShowArchivePeriods: chrome.setShowArchivePeriods,
  };
}
