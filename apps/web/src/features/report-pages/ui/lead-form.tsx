"use client";

import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";
import { useRef, useState } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import {
  markCompletePatch,
  moveToCurrentWeekPatch,
  moveToNextWeekPatch,
  pauseItemPatch,
} from "../../../lib/lead-item-actions";
import type {
  DecisionEntry,
  KanbanItem,
  Product,
  RiskEntry,
} from "../../report-sections";
import { useLeadFormDraftSeam } from "./lead-form-draft-seam";
import { LeadFormLoaded, type LeadFormLoadedData } from "./lead-form-loaded";
import { buildLeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import type { QuickAddKind } from "./quick-add-button";
import { useLeadFormAddSignals } from "./use-lead-form-add-signals";
import { useLeadFormChrome } from "./use-lead-form-chrome";
import { useLeadFormData } from "./use-lead-form-data";
import { useLeadFormDraft } from "./use-lead-form-draft";
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

export { sectionToDraftPayload } from "../../report-sections";

const EMPTY_LOADED_CONTEXT: LeadFormLoadedContext = {
  products: [],
  currentWeekItems: [],
  nextWeekItems: [],
};

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
  // ref shared between lead-form header (SlideFullscreenButton) and
  // LeadSlidesClient (deck root div).
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  // lead-form is the SINGLE fullscreen owner on the hosted path: it threads
  // isFullscreen + toggle into BOTH its toolbar toggle AND LeadSlidesClient
  // (whose local hook is disabled), so exactly one `f`/fullscreenchange
  // listener exists. Focus returns to the toolbar toggle on exit. Gated on
  // slides mode so the edit form adds no `f` listener.
  const slidesFullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    isSlidesMode,
  );

  // Draft module: editable section, autosave, version, readiness, submit, and
  // every merge behind one handle. Its live view-model inputs enter as the
  // `loaded` render arg, carried across renders by this component's local ref
  // (the value is one render behind — benign for the modal quick-add
  // callbacks — and no ref object crosses into the module).
  const loadedContextRef = useRef<LeadFormLoadedContext>(EMPTY_LOADED_CONTEXT);
  const seam = useLeadFormDraftSeam();
  const draft = useLeadFormDraft({
    serverSection: data.byPeriodData?.section,
    sectionIdForActions: data.sectionIdForActions,
    serverReadOnly: data.byPeriodData ? data.byPeriodData.readOnly : true,
    refetchSection: data.refetchSection,
    crossAuthors: data.crossAuthors,
    isEveryone: data.isEveryone,
    // eslint-disable-next-line react-hooks/refs -- passes the sanctioned render->callback bridge ref value; consumed only inside post-commit callbacks
    loaded: loadedContextRef.current,
    seam,
  });
  const addSignals = useLeadFormAddSignals();

  // Draft dialog lifecycle: submit-confirm, revoke, reopen, fill-from. Calls
  // the draft module's submit and reads its readiness.
  const writeActions = useLeadFormWriteActions({
    sectionIdForActions: data.sectionIdForActions,
    autosaveDirty: draft.autosave.dirty,
    submitReadiness: draft.submitReadiness,
    submit: draft.submit,
    version: draft.version,
    setIsSubmitted: draft.setIsSubmitted,
    handleConflict: draft.handleConflict,
  });

  // simplify-stage-status-interaction: stages the lead left unset (null
  // traffic) auto-promote to On Track at submit, warned first. stageStatuses
  // only carries the lead's OWN stages, so a null entry is a genuinely unset
  // own stage. Both the confirm-dialog warning and the coercion read this one
  // count, so they can never disagree.
  const unsetOwnStageCount = (draft.draftPayload?.stageStatuses ?? []).filter(
    (status) => status.status == null,
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
    !draft.draft
  ) {
    return <LeadFormSkeleton />;
  }

  // Loaded display derivations (lead-form-loaded-view-model) — one object,
  // consumed by the section/header/toolbar/dialog components.
  const viewModel = buildLeadFormLoadedViewModel({
    active: data.activeData ?? draft.draft,
    draftSection: draft.draft,
    serverReadOnly: data.byPeriodData.readOnly,
    canRequestReopen: data.byPeriodData.canRequestReopen,
    publishedLineage: data.byPeriodData.publishedLineage,
    history: data.historyData,
    crossAuthors: data.crossAuthors,
    foreignContent: data.foreignContent,
    isEveryone: data.isEveryone,
    visibilityHydrated: data.visibilityHydrated,
    isForeignSlidesDeck: data.isForeignSlidesDeck,
    isSubmitted: draft.isSubmitted,
    selectedPeriodId,
    showArchivePeriods,
  });
  // Refresh the loaded context the module's quick-add callbacks read next
  // render. Only VALUES flow into the module — no ref protocol crosses the
  // file boundary, so the module owns its own refresh ordering.
  // eslint-disable-next-line react-hooks/refs -- the one sanctioned render->callback bridge: stamps the loaded context the module's quick-add callbacks read after commit
  loadedContextRef.current = {
    products: viewModel.products,
    currentWeekItems: viewModel.currentWeekItems,
    nextWeekItems: viewModel.nextWeekItems,
  };

  const quickAddByKind: Record<QuickAddKind, () => void> = {
    "current-item": () => draft.quickAdd("current"),
    "next-item": () => draft.quickAdd("next"),
    blocker: () =>
      draft.routeToBlocker({
        productId: viewModel.products[0]?.id ?? "",
        stageIds: [],
        severity: "blocked",
      }),
    risk: addSignals.addRisk,
    decision: addSignals.addDecision,
  };
  const onQuickAdd = (kind: QuickAddKind) => quickAddByKind[kind]();

  // The declared slice `LeadFormLoaded` and its children read — narrower than
  // `data`, which also carries this component's own draft/chrome inputs.
  const loadedData: LeadFormLoadedData = {
    byPeriodData: data.byPeriodData,
    toolbarVisibility: data.toolbarVisibility,
    setRecordVisibility: data.setRecordVisibility,
    isForeignSlidesDeck: data.isForeignSlidesDeck,
    targetReportId: data.targetReportId,
    activeReportId: data.activeReportId,
    visibilityHydrated: data.visibilityHydrated,
    unifiedView: data.unifiedView,
    recordVisibility: data.recordVisibility,
    crossAuthors: data.crossAuthors,
  };

  const patchItem = (
    itemId: string,
    patch: Partial<ReportSectionReadModel["items"][number]>,
  ) => draft.apply({ kind: "item-patch", itemId, patch });
  const draftActions = {
    onProductsChange: (next: Product[]) =>
      draft.apply({ kind: "products", products: next }),
    onRisksChange: (next: RiskEntry[]) =>
      draft.apply({ kind: "risks", risks: next }),
    onDecisionsChange: (next: DecisionEntry[]) =>
      draft.apply({ kind: "decisions", decisions: next }),
    onCurrentWeekItemsChange: (items: KanbanItem[]) =>
      draft.apply({ kind: "week-items", week: "current", items }),
    onNextWeekItemsChange: (items: KanbanItem[]) =>
      draft.apply({ kind: "week-items", week: "next", items }),
    onMarkComplete: (itemId: string) => patchItem(itemId, markCompletePatch()),
    onMoveToNextWeek: (itemId: string) =>
      patchItem(itemId, moveToNextWeekPatch()),
    onMoveToCurrentWeek: (itemId: string) =>
      patchItem(itemId, moveToCurrentWeekPatch()),
    onPauseItem: (itemId: string, reason: string) =>
      patchItem(itemId, pauseItemPatch(reason)),
    onActivityStatusChange: (activityId: string, status: TrafficLightStatus) =>
      draft.apply({ kind: "activity-status", activityId, status }),
    onActivityRaiseRequiresRisk: (
      activityId: string,
      severity: "at-risk" | "blocked",
    ) =>
      draft.routeToBlocker({
        productId: "",
        stageIds: [],
        severity,
        activityId,
      }),
    onQuickAdd,
    quickAddItem: draft.pendingQuickAdd,
    onQuickAddSave: draft.quickAddSave,
    onQuickAddCancel: draft.clearQuickAdd,
    riskPrefill: draft.pendingRiskPrefill,
    ...addSignals,
  };

  return (
    <LeadFormLoaded
      data={loadedData}
      viewModel={viewModel}
      draftSection={draft.draft}
      autosave={draft.autosave}
      submitReadiness={draft.submitReadiness}
      draftActions={draftActions}
      writeActions={writeActions}
      isSlidesMode={isSlidesMode}
      isSubmitted={draft.isSubmitted}
      pinnedReportId={pinnedReportId}
      showArchivePeriods={showArchivePeriods}
      setShowArchivePeriods={setShowArchivePeriods}
      groupExpanded={groupExpanded}
      setGroupExpanded={setGroupExpanded}
      deckRef={deckRef}
      fullscreenToggleRef={fullscreenToggleRef}
      slidesFullscreen={slidesFullscreen}
      unsetOwnStageCount={unsetOwnStageCount}
    />
  );
}
