"use client";

import {
  buildLeadFormLoadedViewModel,
  leadFormGenerationOf,
  type LeadFormLoadedContext,
} from "../../../../report-sections";
import { useLeadFormQuickAdd } from "../../../../report-sections/client";
import { buildDraftActions } from "../chrome/lead-form-draft-actions";
import { LeadFormLoadError } from "./lead-form-load-error";
import { LeadFormLoaded } from "./lead-form-loaded";
import {
  buildLeadFormLoadedData,
  leadFormViewModelInput,
  loadedContextOf,
  resolveLeadFormLoaded,
} from "./lead-form-loaded-inputs";
import { LeadFormSkeleton } from "./lead-form-skeleton";
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

function LeadFormUnavailable() {
  return (
    <section
      aria-labelledby="lead-form-unavailable-title"
      className="card-surface space-y-3 p-6"
    >
      <h1
        id="lead-form-unavailable-title"
        className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]"
      >
        Report form unavailable
      </h1>
      <p role="status" className="text-sm text-[var(--color-foreground)]">
        This reporting period does not have an editable section for your
        account.
      </p>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Choose a report assigned to you or contact your reporting lead.
      </p>
    </section>
  );
}

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
  // A failed primary read can retain cached `byPeriodData`. Do not derive a
  // loaded view model from that cache: the top-level error surface must hide
  // every stale editable record until a successful retry arrives.
  const loaded = data.byPeriodError
    ? null
    : resolveLeadFormLoaded(data, editing.draft.draft);
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
  if (data.sectionUnavailable) return <LeadFormUnavailable />;
  if (data.byPeriodError) {
    return (
      <LeadFormLoadError
        isRetrying={data.byPeriodFetching}
        onRetry={() => {
          if (!data.byPeriodFetching) void data.retrySection();
        }}
      />
    );
  }
  if (loaded === null || viewModel === null) {
    return <LeadFormSkeleton mode={state.isSlidesMode ? "slides" : "edit"} />;
  }

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
      density={shell.density}
      onDensityChange={shell.setDensity}
      slidesFullscreen={shell.slidesFullscreen}
      unsetOwnStageCount={editing.unsetOwnStageCount}
    />
  );
}
