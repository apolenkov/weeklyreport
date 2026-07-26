"use client";

import { useRef } from "react";

import { buildDraftActions } from "./lead-form-draft-actions";
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

export function LeadForm(props: LeadFormProps) {
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
  // Draft module handle; `loaded` is one render behind via local ref
  // (benign for modal quick-add; no ref object crosses into the module).
  const loadedContextRef = useRef<LeadFormLoadedContext>(EMPTY_LOADED_CONTEXT);
  const editing = useLeadFormEditing({
    pinnedReportId,
    data,
    // eslint-disable-next-line react-hooks/refs -- passes the sanctioned render->callback bridge ref value; consumed only inside post-commit callbacks
    loaded: loadedContextRef.current,
  });
  const { draft } = editing;

  const loaded = resolveLeadFormLoaded(data, draft.draft);
  if (loaded === null) return <LeadFormSkeleton />;

  const viewModel = buildLeadFormLoadedViewModel(
    leadFormViewModelInput(data, loaded, editing),
  );
  // eslint-disable-next-line react-hooks/refs -- the one sanctioned render->callback bridge: stamps the loaded context the module's quick-add callbacks read after commit
  loadedContextRef.current = loadedContextOf(viewModel);
  const actions = buildDraftActions(draft, editing.addSignals, viewModel);

  return (
    <LeadFormLoaded
      data={buildLeadFormLoadedData(data)}
      viewModel={viewModel}
      draftSection={loaded.draftSection}
      autosave={draft.autosave}
      submitReadiness={draft.submitReadiness}
      draftActions={actions}
      writeActions={editing.writeActions}
      isSlidesMode={isSlidesMode}
      isSubmitted={editing.isSubmitted}
      pinnedReportId={pinnedReportId}
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
