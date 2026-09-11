"use client";

import type { ReportSectionReadModel } from "@customreport/shared";

import {
  buildLeadFormLoadedViewModel,
  type DraftPatch,
  leadFormGenerationOf,
  type LeadFormLoadedContext,
  type LeadSubmitReadiness,
  type SubmitOutcome,
} from "../../../../report-sections";
import type {
  AutosaveSaveReceipt,
  AutosaveSnapshot,
  LeadFormOutcomeActions,
} from "../../../../report-sections/client";
import {
  type LeadFormWritePort,
  useLeadFormQuickAdd,
  useLeadFormWritePort,
} from "../../../../report-sections/client";
import {
  buildDraftActions,
  type LeadFormDraftHandle,
} from "../chrome/lead-form-draft-actions";
import type { LeadFormWriteActions } from "../chrome/use-lead-form-write-actions";
import type { LeadFormLoadedProps } from "./lead-form-loaded";
import {
  buildLeadFormLoadedData,
  leadFormViewModelInput,
  loadedContextOf,
  resolveLeadFormLoaded,
} from "./lead-form-loaded-inputs";
import { useLeadFormData } from "./use-lead-form-data";
import { useLeadFormEditing } from "./use-lead-form-editing";

export interface LeadFormEditorInput {
  readonly reportId?: string | undefined;
  readonly mode?: "overview" | "edit" | "slides" | undefined;
  readonly redirectToCanonical?: boolean | undefined;
}

export type LeadFormEditorHandle =
  | { readonly status: "unavailable" }
  | { readonly status: "no-active" }
  | {
      readonly status: "error";
      readonly isRetrying: boolean;
      readonly retry: () => void;
    }
  | {
      readonly status: "loading";
      readonly mode: "overview" | "edit" | "slides";
    }
  | {
      readonly status: "ready";
      readonly generation: string | null;
      readonly draft: LeadFormEditorDraftHandle;
      readonly outcomes: LeadFormOutcomeActions;
      readonly writes: LeadFormWriteActions;
      readonly view: LeadFormLoadedProps;
    };

export interface LeadFormEditorDraftHandle extends LeadFormDraftHandle {
  readonly section: ReportSectionReadModel;
  readonly dirty: boolean;
  readonly version: number;
  readonly autosave: AutosaveSnapshot;
  readonly lastSaveReceipt: AutosaveSaveReceipt | null;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly apply: (patch: DraftPatch) => void;
  readonly save: () => Promise<void>;
  readonly submit: () => Promise<SubmitOutcome>;
}

const EMPTY_LOADED_CONTEXT: LeadFormLoadedContext = {
  products: [],
  currentWeekItems: [],
  nextWeekItems: [],
};

// External Lead Form seam. Draft merge and write actions remain separate
// internal seams, while callers receive one declared handle.
export function useLeadFormEditor(
  input: LeadFormEditorInput,
): LeadFormEditorHandle {
  const writePort = useLeadFormWritePort();
  return useLeadFormEditorWithPort(input, writePort);
}

export function useLeadFormEditorWithPort(
  {
    reportId: pinnedReportId,
    redirectToCanonical,
    mode = "edit",
  }: LeadFormEditorInput,
  writePort: LeadFormWritePort,
): LeadFormEditorHandle {
  const isSlidesMode = mode === "slides";
  const data = useLeadFormData({
    reportId: pinnedReportId,
    redirectToCanonical,
    isSlidesMode,
    canonicalMode: mode === "overview" ? undefined : mode,
  });
  const generation = data.byPeriodData
    ? leadFormGenerationOf(data.byPeriodData.section)
    : null;
  const editing = useLeadFormEditing({
    generation,
    pinnedReportId,
    data,
    writePort,
  });
  const loaded =
    data.readState.status === "ready"
      ? resolveLeadFormLoaded(data, editing.draft.draft)
      : null;
  const viewModel = loaded
    ? buildLeadFormLoadedViewModel(
        leadFormViewModelInput(data, loaded, editing),
      )
    : null;
  const quickAdd = useLeadFormQuickAdd({
    apply: editing.draft.apply,
    generation: editing.draft.generation,
    loaded: viewModel ? loadedContextOf(viewModel) : EMPTY_LOADED_CONTEXT,
  });
  const draft = { ...editing.draft, ...quickAdd };

  if (data.awaitingRoleRedirect || data.awaitingCanonicalRedirect) {
    return { status: "loading", mode };
  }
  if (
    data.readState.status === "unavailable" ||
    data.readState.status === "no-active"
  ) {
    return { status: data.readState.status };
  }
  if (data.readState.status === "error") {
    const { isRetrying, retry } = data.readState;
    return {
      status: "error",
      isRetrying,
      retry: () => {
        if (!isRetrying) void retry();
      },
    };
  }
  if (loaded === null || viewModel === null) {
    return { status: "loading", mode };
  }

  return {
    status: "ready",
    generation: draft.generation,
    outcomes: draft.outcomes,
    draft: {
      section: loaded.draftSection,
      dirty: draft.dirty,
      version: draft.version,
      autosave: draft.autosave,
      lastSaveReceipt: draft.lastSaveReceipt,
      submitReadiness: draft.submitReadiness,
      apply: draft.apply,
      save: draft.save,
      submit: draft.submit,
      routeToBlocker: draft.routeToBlocker,
      quickAdd: draft.quickAdd,
      pendingQuickAdd: draft.pendingQuickAdd,
      quickAddSave: draft.quickAddSave,
      clearQuickAdd: draft.clearQuickAdd,
      pendingRiskPrefill: draft.pendingRiskPrefill,
    },
    writes: editing.writeActions,
    view: {
      data: buildLeadFormLoadedData(data),
      viewModel,
      draftSection: loaded.draftSection,
      autosave: draft.autosave,
      submitReadiness: draft.submitReadiness,
      draftActions: buildDraftActions(draft, editing.addSignals, viewModel),
      writeActions: editing.writeActions,
      isSlidesMode,
      isSubmitted: editing.isSubmitted,
      pinnedReportId,
      showArchivePeriods: editing.showArchivePeriods,
      onShowArchivePeriodsChange: editing.setShowArchivePeriods,
      unsetOwnStageCount: editing.unsetOwnStageCount,
    },
  };
}
