"use client";

import { useRef, useState } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import { SdlcTooltipProvider } from "../../../shared/ui/sdlc-tooltip";
import { LeadSlidesClient } from "../../slides";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { LeadFormDialogs } from "./lead-form-dialogs";
import { LeadFormEditSections } from "./lead-form-edit-sections";
import { LeadFormHeaderActions } from "./lead-form-header-actions";
import { buildLeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormPastPeriodBanner } from "./lead-form-past-period-banner";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { LeadFormToolbarControls } from "./lead-form-toolbar-controls";
import { useLeadFormChrome } from "./use-lead-form-chrome";
import { useLeadFormData } from "./use-lead-form-data";
import { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";
import { useLeadFormDraftOrchestration } from "./use-lead-form-draft-orchestration";
import { useLeadFormWriteActions } from "./use-lead-form-write-actions";

interface LeadFormProps {
  /**
   * Explicit report identifier from the dynamic `[reportId]` route segment;
   * addressed-route semantics are documented on `UseLeadFormDataInput`.
   */
  readonly reportId?: string;
  readonly mode?: "edit" | "slides";
  /** Bare-route canonical redirect; see `UseLeadFormDataInput`. */
  readonly redirectToCanonical?: boolean;
}

export { sectionToDraftPayload } from "../model/lead-section-draft-payload";

export function LeadForm({
  reportId: pinnedReportId,
  redirectToCanonical,
  mode = "edit",
}: LeadFormProps) {
  const isSlidesMode = mode === "slides";
  // Data-loading boundary (lead-form-data-loading): queries, gating, purges,
  // redirects, error handlers. Called first so the hook order stays fixed.
  const data = useLeadFormData({
    reportId: pinnedReportId,
    redirectToCanonical,
    isSlidesMode,
  });
  // W9.A: ref shared between lead-form header (SlideFullscreenButton) and LeadSlidesClient (deck root div)
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  // add-slide-fullscreen-exit-affordance: lead-form is the SINGLE fullscreen
  // owner on the hosted path. It threads isFullscreen + toggle into BOTH its
  // toolbar toggle AND LeadSlidesClient (whose local hook is disabled), so
  // exactly one `f`/fullscreenchange listener exists. Focus returns to the
  // toolbar toggle on exit. Gated on slides mode so the edit form adds no `f`.
  const slidesFullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    isSlidesMode,
  );

  // ---- Local UI + draft state ----
  const {
    autosave,
    draftPayload,
    draftSection,
    handleConflict,
    isSubmitted,
    setDraftSection,
    setIsSubmitted,
    setVersionSafe,
    versionRef,
  } = useLeadFormDraftOrchestration({
    serverSection: data.byPeriodData?.section,
    sectionIdForActions: data.sectionIdForActions,
    serverReadOnly: data.byPeriodData ? data.byPeriodData.readOnly : true,
    refetchSection: data.refetchSection,
  });

  const writeActionSubmitContextRef = useRef<{
    draftPayload: typeof draftPayload;
    products: readonly Product[];
    ownRisks: readonly RiskEntry[];
  }>({ draftPayload: null, products: [], ownRisks: [] });

  // One object — the header/dialog components consume it wholesale.
  const writeActions = useLeadFormWriteActions({
    sectionIdForActions: data.sectionIdForActions,
    autosaveDirty: autosave.dirty,
    getSubmitContext: () => writeActionSubmitContextRef.current,
    versionRef,
    setVersionSafe,
    setIsSubmitted,
    handleConflict,
  });

  const draftMergeContextRef = useRef<{
    products: readonly Product[];
    currentWeekItems: readonly KanbanItem[];
    nextWeekItems: readonly KanbanItem[];
  }>({ products: [], currentWeekItems: [], nextWeekItems: [] });

  // One object — the section/header/dialog components consume it wholesale.
  const merges = useLeadFormDraftMerges({
    setDraftSection,
    getLoadedContext: () => draftMergeContextRef.current,
  });

  // simplify-stage-status-interaction (D4): stages the lead left unset (null
  // traffic) auto-promote to On Track at submit, warned first. stageStatuses
  // only carries the lead's OWN stages, so a null entry is a genuinely unset
  // own stage. Both the confirm-dialog warning and the coercion below read this
  // one count, so they can never disagree.
  const unsetOwnStageCount = (draftPayload?.stageStatuses ?? []).filter(
    (s) => s.status == null,
  ).length;

  // Toggle All state — must live above the early return below, otherwise the
  // hook count drifts between renders ("Rendered more hooks" crash). Each
  // toggle flips groupExpanded; AccordionSection mirrors it into local state.
  const [groupExpanded, setGroupExpanded] = useState(true);

  // Page chrome (document title + archived-period auto-expand) lives behind
  // the feature-local chrome hook; only the archive state returns.
  const { selectedPeriodId, showArchivePeriods, setShowArchivePeriods } =
    useLeadFormChrome({
      pinnedReportId,
      activeReportId: data.activeReportId,
      byPeriodData: data.byPeriodData,
      history: data.historyData,
    });

  // Skeleton until all queries settle.
  if (
    data.isLoading ||
    data.awaitingRoleRedirect ||
    data.awaitingCanonicalRedirect ||
    data.activeData === undefined ||
    !data.byPeriodData ||
    !data.historyData ||
    !draftSection
  ) {
    return <LeadFormSkeleton />;
  }

  // Loaded display derivations (lead-form-loaded-view-model) — one object,
  // consumed wholesale by the section/header/toolbar/dialog components.
  const viewModel = buildLeadFormLoadedViewModel({
    active: data.activeData ?? draftSection,
    draftSection,
    serverReadOnly: data.byPeriodData.readOnly,
    canRequestReopen: data.byPeriodData.canRequestReopen,
    publishedLineage: data.byPeriodData.publishedLineage,
    history: data.historyData,
    crossAuthors: data.crossAuthors,
    foreignContent: data.foreignContent,
    isEveryone: data.isEveryone,
    visibilityHydrated: data.visibilityHydrated,
    isForeignSlidesDeck: data.isForeignSlidesDeck,
    isSubmitted,
    selectedPeriodId,
    showArchivePeriods,
  });
  writeActionSubmitContextRef.current = {
    draftPayload,
    products: viewModel.products,
    ownRisks: viewModel.ownRisks,
  };
  draftMergeContextRef.current = {
    products: viewModel.products,
    currentWeekItems: viewModel.currentWeekItems,
    nextWeekItems: viewModel.nextWeekItems,
  };

  return (
    <SdlcTooltipProvider>
      <form className="space-y-6" data-testid="lead-report-form">
        <LeadFormHeaderActions
          viewModel={viewModel}
          merges={merges}
          writeActions={writeActions}
          autosave={autosave}
          isSlidesMode={isSlidesMode}
          isSubmitted={isSubmitted}
        />

        <LeadFormToolbarControls
          viewModel={viewModel}
          leadSubmittedAt={data.byPeriodData.section.submittedAt ?? null}
          showArchivePeriods={showArchivePeriods}
          onShowArchivePeriodsChange={setShowArchivePeriods}
          toolbarVisibility={data.toolbarVisibility}
          onVisibilityChange={data.setRecordVisibility}
          isForeignSlidesDeck={data.isForeignSlidesDeck}
          isSlidesMode={isSlidesMode}
          targetReportId={data.targetReportId}
          slidesFullscreen={slidesFullscreen}
          fullscreenToggleRef={fullscreenToggleRef}
          groupExpanded={groupExpanded}
          setGroupExpanded={setGroupExpanded}
        />

        <LeadFormPastPeriodBanner
          pinnedReportId={pinnedReportId}
          activeReportId={data.activeReportId}
          isSubmitted={isSubmitted}
        />

        {isSlidesMode ? (
          <LeadSlidesClient
            initialReportId={data.targetReportId || pinnedReportId || null}
            chrome="content"
            deckRef={deckRef}
            // add-slide-fullscreen-exit-affordance: lead-form owns the single
            // fullscreen hook; the deck's local hook is disabled and it renders
            // the floating pill + Esc hint presentationally from these props.
            isFullscreen={slidesFullscreen.isFullscreen}
            onToggle={slidesFullscreen.toggle}
            // slides-record-visibility: thread the toolbar's visibility state so
            // the deck shows Mine vs Everyone. LeadSlidesClient owns the own-deck
            // gate + the gated cross-author fetch/merge; lead-form just supplies
            // the (hydrated) toggle value, forced to Mine on a foreign deck.
            visibilityMode={data.toolbarVisibility}
            visibilityHydrated={data.visibilityHydrated}
          />
        ) : (
          <LeadFormEditSections
            viewModel={viewModel}
            merges={merges}
            draftSection={draftSection}
            serverSection={data.byPeriodData.section}
            groupExpanded={groupExpanded}
            unifiedView={data.unifiedView}
            recordVisibility={data.recordVisibility}
            visibilityHydrated={data.visibilityHydrated}
            crossAuthorEntries={data.crossAuthors}
          />
        )}
      </form>

      <LeadFormDialogs
        viewModel={viewModel}
        merges={merges}
        writeActions={writeActions}
        unsetOwnStageCount={unsetOwnStageCount}
        draftSection={draftSection}
      />
    </SdlcTooltipProvider>
  );
}
