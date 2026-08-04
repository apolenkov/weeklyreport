"use client";

import { buildDraftActions } from "./lead-form-draft-actions";
import { leadFormGenerationOf } from "./lead-form-generation";
import { LeadFormLoaded } from "./lead-form-loaded";
import {
  buildLeadFormLoadedData,
  leadFormViewModelInput,
  loadedContextOf,
  resolveLeadFormLoaded,
} from "./lead-form-loaded-inputs";
import { buildLeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import { useLeadFormEditing } from "./use-lead-form-editing";
import { useLeadFormQuickAdd } from "./use-lead-form-quick-add";
import { useLeadFormShell } from "./use-lead-form-shell";

interface LeadFormProps {
  // Explicit report id from `[reportId]`; bare-route redirect on UseLeadFormDataInput.
  readonly reportId?: string;
  readonly mode?: "edit" | "slides";
  readonly redirectToCanonical?: boolean;
}

const EMPTY_LOADED_CONTEXT: LeadFormLoadedContext = {
  products: [],
  currentWeekItems: [],
  nextWeekItems: [],
};

function useLeadFormState(props: LeadFormProps) {
  const {
    reportId: pinnedReportId,
    redirectToCanonical,
    mode = "edit",
  } = props;
  const isSlidesMode = mode === "slides";
  const shell = useLeadFormShell({
    pinnedReportId,
    redirectToCanonical,
    isSlidesMode,
  });
  const { data } = shell;
  const generation = data.byPeriodData
    ? leadFormGenerationOf(data.byPeriodData.section)
    : null;
  const editing = useLeadFormEditing({
    generation,
    pinnedReportId,
    data,
  });
  const loaded = resolveLeadFormLoaded(data, editing.draft.draft);
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
  return {
    data,
    draft,
    editing,
    isSlidesMode,
    loaded,
    pinnedReportId,
    shell,
    viewModel,
  };
}

export function LeadForm(props: LeadFormProps) {
  const state = useLeadFormState(props);
  const { data, draft, editing, loaded, shell, viewModel } = state;
  if (loaded === null || viewModel === null) return <LeadFormSkeleton />;

  const actions = buildDraftActions(draft, editing.addSignals, viewModel);

  return (
    <LeadFormLoaded
      key={draft.generation}
      data={buildLeadFormLoadedData(data)}
      viewModel={viewModel}
      draftSection={loaded.draftSection}
      autosave={draft.autosave}
      submitReadiness={draft.submitReadiness}
      draftActions={actions}
      writeActions={editing.writeActions}
      isSlidesMode={state.isSlidesMode}
      isSubmitted={editing.isSubmitted}
      pinnedReportId={state.pinnedReportId}
      showArchivePeriods={editing.showArchivePeriods}
      setShowArchivePeriods={editing.setShowArchivePeriods}
      groupExpanded={editing.groupExpanded}
      setGroupExpanded={editing.setGroupExpanded}
      deckRef={shell.deckRef}
      fullscreenToggleRef={shell.fullscreenToggleRef}
      slidesFullscreen={shell.slidesFullscreen}
      unsetOwnStageCount={editing.unsetOwnStageCount}
    />
  );
}
