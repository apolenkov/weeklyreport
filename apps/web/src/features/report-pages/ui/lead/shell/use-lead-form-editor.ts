"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";

import {
  buildLeadFormLoadedViewModel,
  type DraftPatch,
  type DraftStageMemory,
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
  type LeadFormLoadingState,
  type LeadFormViewModelData,
  leadFormViewModelInput,
  loadedContextOf,
  resolveLeadFormLoaded,
} from "./lead-form-loaded-inputs";
import { useLeadFormData } from "./use-lead-form-data";
import {
  type LeadFormEditingData,
  useLeadFormEditing,
} from "./use-lead-form-editing";
import type { LeadFormRequiredReadState } from "./use-lead-form-required-reads";

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

type PersistedSaveResult =
  import("../../../../report-sections/model/autosave/autosave-types").PersistedSaveResult;

interface LeadFormEditorDraftHandle extends LeadFormDraftHandle {
  // Open-draft stage memory: one instance per draft generation.
  readonly stageMemory: DraftStageMemory;
  readonly abandonPersisted: (token: string) => void;
  readonly savePersisted: (token: string) => Promise<PersistedSaveResult>;
  readonly section: ReportSectionReadModel;
  readonly dirty: boolean;
  readonly version: number;
  readonly autosave: AutosaveSnapshot;
  readonly receiptScope: string;
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

function notReadyHandle(
  data: {
    readonly awaitingRoleRedirect: boolean;
    readonly awaitingCanonicalRedirect: boolean;
    readonly readState: LeadFormRequiredReadState;
  },
  mode: "overview" | "edit" | "slides",
): LeadFormEditorHandle | null {
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
  return null;
}

function buildEditorDraftHandle(
  draft: Omit<LeadFormEditorDraftHandle, "section">,
  section: ReportSectionReadModel,
): LeadFormEditorDraftHandle {
  return {
    section,
    stageMemory: draft.stageMemory,
    dirty: draft.dirty,
    version: draft.version,
    autosave: draft.autosave,
    receiptScope: draft.receiptScope,
    lastSaveReceipt: draft.lastSaveReceipt,
    submitReadiness: draft.submitReadiness,
    apply: draft.apply,
    save: draft.save,
    savePersisted: draft.savePersisted,
    abandonPersisted: draft.abandonPersisted,
    submit: draft.submit,
    routeToBlocker: draft.routeToBlocker,
    quickAdd: draft.quickAdd,
    pendingQuickAdd: draft.pendingQuickAdd,
    quickAddSave: draft.quickAddSave,
    clearQuickAdd: draft.clearQuickAdd,
    pendingRiskPrefill: draft.pendingRiskPrefill,
  };
}

// External Lead Form seam. The production pending reader receives the actual
// section owner; the deterministic port seam retains the same public contract.
function useEditorData({
  reportId,
  redirectToCanonical,
  mode = "edit",
}: LeadFormEditorInput) {
  return useLeadFormData({
    reportId,
    redirectToCanonical,
    isSlidesMode: mode === "slides",
    canonicalMode: mode === "overview" ? undefined : mode,
  });
}

export function useLeadFormEditor(
  input: LeadFormEditorInput,
): LeadFormEditorHandle {
  const data = useEditorData(input);
  const writePort = useLeadFormWritePort(data.sectionIdForActions);
  return useLeadFormEditorWithData(input, writePort, data);
}

export function useLeadFormEditorWithPort(
  input: LeadFormEditorInput,
  writePort: LeadFormWritePort,
): LeadFormEditorHandle {
  return useLeadFormEditorWithData(input, writePort, useEditorData(input));
}

type LeadFormEditorData = LeadFormLoadingState &
  LeadFormViewModelData &
  LeadFormEditingData &
  Parameters<typeof buildLeadFormLoadedData>[0] & {
    readonly readState: LeadFormRequiredReadState;
  };

function useLeadFormEditorWithData(
  { reportId: pinnedReportId, mode = "edit" }: LeadFormEditorInput,
  writePort: LeadFormWritePort,
  data: LeadFormEditorData,
): LeadFormEditorHandle {
  const isSlidesMode = mode === "slides";
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

  const pending = notReadyHandle(data, mode);
  if (pending) return pending;
  if (loaded === null || viewModel === null) return { status: "loading", mode };

  return {
    status: "ready",
    generation: draft.generation,
    outcomes: draft.outcomes,
    draft: buildEditorDraftHandle(draft, loaded.draftSection),
    writes: editing.writeActions,
    view: {
      data: buildLeadFormLoadedData(data),
      viewModel,
      draftSection: loaded.draftSection,
      autosave: draft.autosave,
      submitReadiness: draft.submitReadiness,
      draftActions: buildDraftActions(
        draft,
        editing.addSignals,
        viewModel,
        loaded.draftSection,
      ),
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
