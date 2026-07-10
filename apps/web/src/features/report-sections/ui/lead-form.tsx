"use client";

import { Separator } from "@customreport/ui/components/ui/separator";
import { useEffect, useMemo, useRef, useState } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import {
  DocumentActionGroup,
  ReportToolbar,
} from "../../../shared/ui/report-shell/report-toolbar";
import { SaveNowButton } from "../../../shared/ui/report-shell/save-now-button";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { SdlcTooltipProvider } from "../../../shared/ui/sdlc-tooltip";
import { VersionComingSoonControl } from "../../admin/ui/version-coming-soon";
import { PdfExportComingSoonControl } from "../../pdf-export/ui/pdf-export-coming-soon";
import { FillFromButton } from "../../period/ui/fill-from-button";
import { PeriodNavigator } from "../../period/ui/period-navigator";
import { RequestReopenDialog } from "../../period/ui/request-reopen-dialog";
import type { CrossAuthorEntry } from "../../period/ui/sdlc-pipeline";
import { LeadSlidesClient } from "../../slides/ui/lead-slides-client";
import { SlideFullscreenButton } from "../../slides/ui/slide-fullscreen-button";
import {
  mapLeadReviewFeedback,
  ownedStagesForProject,
} from "../model/lead-form";
import { formatDateRange, isoWeekNumber } from "../model/lead-history";
import type { KanbanItem, Product, RiskEntry } from "../model/mock-data";
import { ItemEditDialog } from "./item-edit-dialog";
import { LeadFormEditSections } from "./lead-form-edit-sections";
import { CollapseIcon } from "./lead-form-icons";
import { buildLeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormSkeleton } from "./lead-form-skeleton";
import { QuickAddButton } from "./quick-add-button";
import { RecordVisibilityToggle } from "./record-visibility-toggle";
import { useLeadFormData } from "./use-lead-form-data";
import { useLeadFormDraftMerges } from "./use-lead-form-draft-merges";
import { useLeadFormDraftOrchestration } from "./use-lead-form-draft-orchestration";
import { useLeadFormWriteActions } from "./use-lead-form-write-actions";

interface LeadFormProps {
  /**
   * 35-07: explicit report identifier from the dynamic `[reportId]` route
   * segment. When provided, the form scopes data load + actions to that
   * specific report instead of the session's active period.
   *
   * When omitted (bare `/lead/report` path), the form still falls back to
   * `reports.getActive` and — once resolved — performs a `router.replace`
   * to the canonical addressed URL `/lead/report/<reportId>` so bookmarks
   * and shared links work.
   */
  readonly reportId?: string;
  readonly mode?: "edit" | "slides";
  /**
   * 35-07: when true, the form auto-redirects (router.replace) to the
   * canonical addressed URL once the active reportId is known. Off when
   * already on a `[reportId]` route.
   */
  readonly redirectToCanonical?: boolean;
}

export { sectionToDraftPayload } from "../model/lead-section-draft-payload";

export function LeadForm({
  reportId: pinnedReportId,
  redirectToCanonical,
  mode = "edit",
}: LeadFormProps) {
  const isSlidesMode = mode === "slides";
  // Data-loading boundary (lead-form-data-loading): queries, enablement,
  // visibility gating, foreign-content purges, redirects, and query error
  // handlers. Called first so the overall hook order stays fixed.
  const {
    activeData,
    activeReportId,
    targetReportId,
    sectionIdForActions,
    byPeriodData,
    refetchSection,
    historyData,
    unifiedView,
    crossAuthors,
    foreignContent,
    recordVisibility,
    visibilityHydrated,
    setRecordVisibility,
    isEveryone,
    isForeignSlidesDeck,
    toolbarVisibility,
    isLoading,
    awaitingRoleRedirect,
    awaitingCanonicalRedirect,
  } = useLeadFormData({
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

  // Foreign stage health for the lead's shared products. The cross-author
  // query already carries authorInitials + RISK-DERIVED per-stage status, so
  // the pipeline entries map straight from it — no foreign item/risk/decision
  // text crosses the API boundary. This status-only read is ALWAYS fetched and
  // ALWAYS drives honest product health; the toggle never gates it (D4a).
  const crossAuthorEntries: CrossAuthorEntry[] = crossAuthors;

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
    serverSection: byPeriodData?.section,
    sectionIdForActions,
    serverReadOnly: byPeriodData ? byPeriodData.readOnly : true,
    refetchSection,
  });

  const writeActionSubmitContextRef = useRef<{
    draftPayload: typeof draftPayload;
    products: readonly Product[];
    ownRisks: readonly RiskEntry[];
  }>({ draftPayload: null, products: [], ownRisks: [] });

  const {
    confirmRevoke,
    fillFromMut,
    handleConfirmSubmit,
    handleFillFrom,
    handleRequestReopen,
    handleRevoke,
    handleSubmit,
    openReopenDialog,
    closeReopenDialog,
    reopenError,
    requestReopenMut,
    revokeMut,
    setShowRevokeDialog,
    setShowSubmitConfirm,
    showReopenDialog,
    showRevokeDialog,
    showSubmitConfirm,
    submitMut,
  } = useLeadFormWriteActions({
    sectionIdForActions,
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

  // Kept as ONE object: LeadFormEditSections/LeadFormItemSections consume it
  // wholesale (the grouped-prop contract); LeadForm reads only the quick-add
  // trio for the dialog host below.
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

  // Toggle All state — must live above the early return below, otherwise
  // the hook count drifts between renders and React throws "Rendered more
  // hooks than during the previous render". Each Toggle All click flips
  // groupExpanded; AccordionSection mirrors the new value into its local
  // state. Individual sections may then drift again via clicks.
  const [groupExpanded, setGroupExpanded] = useState(true);

  // 35-07: set document.title to surface the addressed week in the browser
  // tab. Format: "Week 19, May 4-10 - CustomReport". Resolved from the
  // history entry whose reportId matches the loaded section so the label
  // matches the dropdown. Restores the title on unmount.
  const titleHistoryEntry = useMemo(() => {
    if (!byPeriodData?.section.reportId || !historyData) return null;
    return (
      historyData.find((h) => h.reportId === byPeriodData.section.reportId) ??
      null
    );
  }, [byPeriodData, historyData]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleHistoryEntry) return;
    const start = titleHistoryEntry.periodStart;
    const week = isoWeekNumber(start);
    const range = formatDateRange(start, titleHistoryEntry.periodEnd);
    const previous = document.title;
    document.title = `Week ${week}, ${range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleHistoryEntry]);

  const [showArchivePeriods, setShowArchivePeriods] = useState(false);
  const selectedPeriodId = pinnedReportId || activeData?.reportId || "";
  const selectedHistoryPeriod = historyData?.find(
    (entry) => entry.reportId === selectedPeriodId && entry.reportId !== "",
  );

  useEffect(() => {
    if (selectedHistoryPeriod?.archived) {
      setShowArchivePeriods(true);
    }
  }, [selectedHistoryPeriod?.reportId, selectedHistoryPeriod?.archived]);

  // Skeleton until all queries settle.
  if (
    isLoading ||
    awaitingRoleRedirect ||
    awaitingCanonicalRedirect ||
    activeData === undefined ||
    !byPeriodData ||
    !historyData ||
    !draftSection
  ) {
    return <LeadFormSkeleton />;
  }

  // Loaded display derivations live behind the pure feature-local view-model
  // boundary (lead-form-loaded-view-model). Kept as ONE object: the section
  // stack (LeadFormEditSections) consumes it wholesale; LeadForm destructures
  // only what the header/toolbar/dialog chrome reads.
  const viewModel = buildLeadFormLoadedViewModel({
    active: activeData ?? draftSection,
    draftSection,
    serverReadOnly: byPeriodData.readOnly,
    canRequestReopen: byPeriodData.canRequestReopen,
    publishedLineage: byPeriodData.publishedLineage,
    history: historyData,
    crossAuthors,
    foreignContent,
    isEveryone,
    visibilityHydrated,
    isForeignSlidesDeck,
    isSubmitted,
    selectedPeriodId,
    showArchivePeriods,
  });
  const {
    activityOptions,
    canRequestReopen,
    currentUser,
    currentWeekItems,
    decisions,
    fillFromLocked,
    hasArchivedPeriods,
    isReadOnly,
    nextWeekItems,
    ownCurrentWeekItems,
    ownDecisions,
    ownNextWeekItems,
    ownPeriodRanks,
    ownRisks,
    products,
    risks,
    visiblePeriods,
  } = viewModel;

  // review-acknowledgement (§8): reviewer comments on this lead's OWN records,
  // read from the authoritative SERVER section (not the editable `draftSection`,
  // whose in-place edits could drop the joined comments). Surfaced read-only so a
  // returned (draft) section's feedback is never silent.
  const reviewFeedback = mapLeadReviewFeedback(byPeriodData.section);

  writeActionSubmitContextRef.current = { draftPayload, products, ownRisks };
  draftMergeContextRef.current = { products, currentWeekItems, nextWeekItems };

  // 35-04: per-project stages-the-lead-owns selector. Forwarded into the
  // Item / Risk / Decision dialogs so the SDLC stage dropdown is scoped per
  // project (unify-record-dialogs made decisions product-scoped too).
  const stagesForProduct = (productId: string) =>
    ownedStagesForProject(draftSection, productId);

  function handleToggleAll() {
    setGroupExpanded((prev) => !prev);
  }

  // Autosave indicator label — 4-state badge.
  const autosaveLabel =
    autosave.state === "saving"
      ? "↻ Saving…"
      : autosave.state === "pending"
        ? "● Pending…"
        : autosave.state === "saved" && autosave.lastSavedAt
          ? autosave.lastSavedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : autosave.state === "error"
            ? "⚠ Save failed"
            : "Autosaved";

  // Trailing utility control (edit mode): collapse/expand all sections. The
  // slot is always reserved and disabled when the report has nothing to
  // collapse, so adding/removing sections in-session never shifts the row.
  const hasCollapsibleContent =
    currentWeekItems.length > 0 ||
    nextWeekItems.length > 0 ||
    risks.length > 0 ||
    decisions.length > 0;
  const collapseAllLabel = groupExpanded
    ? "Collapse all sections"
    : "Expand all sections";

  return (
    <SdlcTooltipProvider>
      <form className="space-y-6" data-testid="lead-report-form">
        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
                My Report
              </h1>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                Your report draft and status context.
              </p>
            </div>
            {/* Submitted state uses the .b-ok variant (light teal bg + dark
                teal text) — matches mockup s2 rather than the heavier
                white-on-dark-teal `.b-done` look that read as a destructive
                "locked" signal. */}
            {!isSlidesMode &&
              (isSubmitted ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-starbucks-accent)]">
                  ✓ Submitted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {autosaveLabel}
                </span>
              ))}
          </div>
          {/* report-toolbar-layout: document actions live on the header line's
              right slot, not inside the bordered toolbar. A read-only past
              period hides the real mutating actions (Save/Submit/Fill-From)
              while the inert Coming-soon stubs remain (deferred-feature-pattern).
              Submit is the single brand-green forward primary; reversal
              actions (Request Reopen / Revoke) stay neutral/outline so green
              keeps one "forward, safe-to-commit" meaning. */}
          <DocumentActionGroup>
            <VersionComingSoonControl />
            {/* TODO(lead-pdf-export): lead is excluded from pdfExport
                (role-coverage-gate); this inert ComingSoon control never
                reaches a backend call. */}
            <PdfExportComingSoonControl />
            {!isReadOnly && (
              <FillFromButton
                periods={visiblePeriods}
                disabled={fillFromMut.isPending}
                lockedReason={
                  fillFromLocked
                    ? "Fill from previous cannot replace records that are part of the published report."
                    : undefined
                }
                onFillFrom={handleFillFrom}
              />
            )}
            {!isReadOnly && <SaveNowButton autosave={autosave} />}
            {/* reopen-request-lifecycle (D4): the control is driven by the
                server-computed `canRequestReopen` flag — hidden when the period
                is published/archived or a request is already pending. The client
                does NOT reconstruct the lifecycle policy. */}
            {isSubmitted &&
              currentUser.authorRole === "lead" &&
              canRequestReopen && (
                <button
                  type="button"
                  className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={openReopenDialog}
                  disabled={requestReopenMut.isPending}
                  title="Ask Head to unlock this section"
                >
                  Request Reopen
                </button>
              )}
            {isSubmitted && currentUser.authorRole !== "lead" && (
              <button
                type="button"
                className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleRevoke}
                disabled={revokeMut.isPending}
                title="Revoke submission and unlock the section"
              >
                Revoke
              </button>
            )}
            {/* Quick-add: one picker button routing to the existing per-type
                dialogs (current-item / next-item / decision / risk /
                blocker). report-toolbar-layout: sits immediately before the
                Submit commit — after Save and Fill-From — and stays visible
                in both edit and slides mode so it never disappears. */}
            {!isReadOnly && (
              <QuickAddButton
                onPick={merges.handleQuickAdd}
                disabled={products.length === 0}
              />
            )}
            {!isSubmitted && !isReadOnly && (
              <button
                type="button"
                className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSubmit}
                disabled={submitMut.isPending}
              >
                Submit
              </button>
            )}
          </DocumentActionGroup>
        </header>

        {/* report-toolbar-layout: the bordered toolbar holds only the
            Context-control bar: Agent review · period nav · show-archived ·
            Mine|Everyone · Edit|Slides · collapse/fullscreen. */}
        <ReportToolbar
          sticky
          contextControls={
            <>
              {/* Period navigation (and the show-archived filter) anchor the
                  left; the view controls are pushed to the right by the spacer
                  so "where you are" and "how you see it" read as two clusters. */}
              <PeriodNavigator
                periods={visiblePeriods}
                showLeadSubmissionMarkers
                leadSubmittedAt={byPeriodData.section.submittedAt ?? null}
              />
              {/* Show-archived filter renders only when the lead has archived
                  periods (lead-report-controls-integrity). */}
              {hasArchivedPeriods && (
                <>
                  <Separator
                    orientation="vertical"
                    className="h-5 bg-[var(--color-border)]"
                  />
                  <ArchiveToggle
                    checked={showArchivePeriods}
                    onChange={setShowArchivePeriods}
                  />
                </>
              )}
              <div className="grow" aria-hidden="true" />
              {/* Inert Agent-review placeholder leads the right-aligned view
                  group (head-toolbar-semantics: compact, leading edge). */}
              <AgentReviewComingSoon compact />
              {/* slides-record-visibility: the Record-visibility toggle now
                  renders in BOTH edit and slides (report-toolbar-parity) so the
                  controls after it never shift between modes. In slides it
                  drives the deck via the props threaded into LeadSlidesClient.
                  Disabled until the persisted state hydrates so a click cannot
                  race the restored value. */}
              <RecordVisibilityToggle
                value={toolbarVisibility}
                onChange={setRecordVisibility}
                disabled={isForeignSlidesDeck}
              />
              <ViewModeToggle
                mode={isSlidesMode ? "slides" : "edit"}
                editHref={
                  targetReportId
                    ? `/lead/report/${encodeURIComponent(targetReportId)}`
                    : "/lead/report"
                }
                slidesHref={
                  targetReportId
                    ? `/lead/report/${encodeURIComponent(
                        targetReportId,
                      )}?mode=slides`
                    : "/lead/report"
                }
              />
              {/* Mode-adaptive trailing utility: one fixed-width icon slot.
                  Edit → collapse/expand all sections (always reserved, disabled
                  when empty so the row never shifts); slides → fullscreen toggle.
                  Both render as a square icon button at the shared toolbar
                  height in the same trailing position. */}
              {isSlidesMode ? (
                <SlideFullscreenButton
                  isFullscreen={slidesFullscreen.isFullscreen}
                  onToggle={slidesFullscreen.toggle}
                  buttonRef={fullscreenToggleRef}
                />
              ) : (
                <button
                  type="button"
                  className="btn-press inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleToggleAll}
                  disabled={!hasCollapsibleContent}
                  aria-label={collapseAllLabel}
                  title={collapseAllLabel}
                >
                  <CollapseIcon />
                </button>
              )}
            </>
          }
        />

        {/* Read-only banner for past periods. Triggered — 35-07 — when the
            page renders under a `[reportId]` segment that points at a
            past report instead of the lead's active section. */}
        {pinnedReportId &&
          activeReportId &&
          pinnedReportId !== activeReportId &&
          !isSubmitted && (
            <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <span className="text-sm text-[var(--color-muted-foreground)]">
                Viewing past period. This form is read-only.
              </span>
            </div>
          )}

        {isSlidesMode ? (
          <LeadSlidesClient
            initialReportId={targetReportId || pinnedReportId || null}
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
            visibilityMode={toolbarVisibility}
            visibilityHydrated={visibilityHydrated}
          />
        ) : (
          <LeadFormEditSections
            viewModel={viewModel}
            merges={merges}
            draftSection={draftSection}
            reviewFeedback={reviewFeedback}
            groupExpanded={groupExpanded}
            unifiedView={unifiedView}
            stagesForProduct={stagesForProduct}
            recordVisibility={recordVisibility}
            visibilityHydrated={visibilityHydrated}
            crossAuthorEntries={crossAuthorEntries}
          />
        )}
      </form>

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm submission"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Submit your report?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Your report will be locked and visible to the group head. You will
              not be able to make changes after submission.
            </p>
            {/* 7c.5: the submit summary counts the lead's OWN records only —
                it reflects what will actually be submitted, never the foreign
                read-only records merged in for the Everyone lens. */}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {ownCurrentWeekItems.length}
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  current week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownNextWeekItems.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  next week items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownRisks.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  risks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ownDecisions.length}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  decisions
                </span>
              </div>
            </div>
            {/* simplify-stage-status-interaction (D4): warn that unset own
                stages will be promoted to On Track on submit — announced, not
                silent. Omitted when nothing is unset. */}
            {unsetOwnStageCount > 0 && (
              <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
                {unsetOwnStageCount} stage
                {unsetOwnStageCount === 1 ? "" : "s"} not set — they will be
                marked On Track.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleConfirmSubmit}
                disabled={submitMut.isPending}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add item dialog host — the EXISTING item dialog opened by the
          picker for current-item / next-item. The risk / blocker / decision
          quick-adds open the dialogs the sections already host (a blocker rides
          the severity-blocked risk prefill). */}
      <ItemEditDialog
        key={`quick-add-${merges.quickAddItem?.seq ?? 0}`}
        open={merges.quickAddItem !== null}
        item={null}
        products={products}
        activities={activityOptions}
        week={merges.quickAddItem?.week ?? "current"}
        currentUserName={currentUser.name}
        defaultProductId={products[0]?.id}
        stagesForProduct={stagesForProduct}
        ownPeriodRanks={ownPeriodRanks}
        risks={risks}
        onSave={merges.handleQuickAddSave}
        onCancel={merges.handleQuickAddCancel}
      />

      <RequestReopenDialog
        open={showReopenDialog}
        pending={requestReopenMut.isPending}
        error={reopenError}
        onConfirm={handleRequestReopen}
        onCancel={closeReopenDialog}
      />

      <ConfirmDeleteDialog
        open={showRevokeDialog}
        title="Revoke this submission?"
        preview={currentUser.name}
        subtitle="Their form returns to Draft and they can edit again."
        consequence="The lead will be notified that their submission was revoked."
        confirmLabel="Revoke"
        reversible
        onConfirm={confirmRevoke}
        onCancel={() => setShowRevokeDialog(false)}
      />
    </SdlcTooltipProvider>
  );
}
