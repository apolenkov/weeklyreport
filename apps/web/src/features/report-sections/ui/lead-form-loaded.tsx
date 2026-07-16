"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { useFullscreen } from "../../../hooks/use-fullscreen";
import type { AutosaveSnapshot } from "../../../hooks/use-lead-form-autosave";
import { SdlcTooltipProvider } from "../../../shared/ui/sdlc-tooltip";
import { LeadSlidesClient } from "../../slides";
import type { LeadSubmitReadiness } from "../model/lead-submit-readiness";
import {
  LeadFormDialogs,
  type LeadFormDialogsQuickAdd,
  type LeadFormDialogsWriteActions,
} from "./lead-form-dialogs";
import {
  LeadFormEditSections,
  type LeadFormEditSectionsActions,
} from "./lead-form-edit-sections";
import {
  LeadFormHeaderActions,
  type LeadFormHeaderWriteActions,
} from "./lead-form-header-actions";
import type { LeadFormLoadedViewModel } from "./lead-form-loaded-view-model";
import { LeadFormPastPeriodBanner } from "./lead-form-past-period-banner";
import { LeadFormToolbarControls } from "./lead-form-toolbar-controls";
import { LeadStickyCompletionActions } from "./lead-sticky-completion-actions";
import { LeadSubmitReadinessSummary } from "./lead-submit-readiness-summary";
import type { QuickAddKind } from "./quick-add-button";
import { useHeaderActionsVisibility } from "./use-header-actions-visibility";
import type { useLeadFormData } from "./use-lead-form-data";

type LeadFormLoadedActions = LeadFormEditSectionsActions &
  LeadFormDialogsQuickAdd & {
    readonly onQuickAdd: (kind: QuickAddKind) => void;
  };
type LeadFormLoadedWriteActions = LeadFormHeaderWriteActions &
  LeadFormDialogsWriteActions & { readonly handleSubmit: () => void };

interface LeadFormLoadedProps {
  readonly data: ReturnType<typeof useLeadFormData>;
  readonly viewModel: LeadFormLoadedViewModel;
  readonly draftSection: ReportSectionReadModel;
  readonly autosave: AutosaveSnapshot;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly draftActions: LeadFormLoadedActions;
  readonly writeActions: LeadFormLoadedWriteActions;
  readonly isSlidesMode: boolean;
  readonly isSubmitted: boolean;
  readonly pinnedReportId?: string;
  readonly showArchivePeriods: boolean;
  readonly setShowArchivePeriods: (next: boolean) => void;
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: Dispatch<SetStateAction<boolean>>;
  readonly deckRef: RefObject<HTMLDivElement | null>;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly slidesFullscreen: ReturnType<typeof useFullscreen>;
  readonly unsetOwnStageCount: number;
}

function useCompletionPresentation(props: LeadFormLoadedProps) {
  const { headerActionsVisible, sentinelRef } = useHeaderActionsVisibility();
  const readiness = props.submitReadiness;
  const completionActions = {
    autosave: props.autosave,
    onAdd: props.draftActions.onQuickAdd,
    addDisabled: props.viewModel.products.length === 0,
    onSubmit: props.writeActions.handleSubmit,
    submitDisabled: !readiness.canOpenConfirmation,
    submitDisabledReason: readiness.blockingIssues[0]?.label,
  };
  const showCompletionSurface =
    !props.isSlidesMode && !props.viewModel.isReadOnly;
  const showStickyCompletion = showCompletionSurface && !headerActionsVisible;
  return {
    completionActions,
    headerActionsVisible,
    readiness,
    sentinelRef,
    showCompletionSurface,
    showStickyCompletion,
  };
}

type CompletionPresentation = ReturnType<typeof useCompletionPresentation>;

function LoadedChrome({
  props,
  completion,
  submittedAt,
}: {
  readonly props: LeadFormLoadedProps;
  readonly completion: CompletionPresentation;
  readonly submittedAt: Date | null;
}) {
  const { data, viewModel, writeActions } = props;
  return (
    <>
      <LeadFormHeaderActions
        viewModel={viewModel}
        writeActions={writeActions}
        completionActions={completion.completionActions}
        completionSentinelRef={completion.sentinelRef}
        showCompletionActions={
          props.isSlidesMode || completion.headerActionsVisible
        }
        isSlidesMode={props.isSlidesMode}
        isSubmitted={props.isSubmitted}
      />
      <LeadFormToolbarControls
        viewModel={viewModel}
        leadSubmittedAt={submittedAt}
        showArchivePeriods={props.showArchivePeriods}
        onShowArchivePeriodsChange={props.setShowArchivePeriods}
        toolbarVisibility={data.toolbarVisibility}
        onVisibilityChange={data.setRecordVisibility}
        isForeignSlidesDeck={data.isForeignSlidesDeck}
        isSlidesMode={props.isSlidesMode}
        targetReportId={data.targetReportId}
        slidesFullscreen={props.slidesFullscreen}
        fullscreenToggleRef={props.fullscreenToggleRef}
        groupExpanded={props.groupExpanded}
        setGroupExpanded={props.setGroupExpanded}
      />
      <LeadFormPastPeriodBanner
        pinnedReportId={props.pinnedReportId}
        activeReportId={data.activeReportId}
        isSubmitted={props.isSubmitted}
      />
    </>
  );
}

function LoadedReportContent({
  props,
  completion,
  serverSection,
}: {
  readonly props: LeadFormLoadedProps;
  readonly completion: CompletionPresentation;
  readonly serverSection: ReportSectionReadModel;
}) {
  const { data, viewModel, draftActions } = props;
  if (props.isSlidesMode) {
    return (
      <LeadSlidesClient
        initialReportId={data.targetReportId || props.pinnedReportId || null}
        chrome="content"
        deckRef={props.deckRef}
        isFullscreen={props.slidesFullscreen.isFullscreen}
        onToggle={props.slidesFullscreen.toggle}
        visibilityMode={data.toolbarVisibility}
        visibilityHydrated={data.visibilityHydrated}
      />
    );
  }
  return (
    <>
      <LeadFormEditSections
        viewModel={viewModel}
        actions={draftActions}
        draftSection={props.draftSection}
        serverSection={serverSection}
        groupExpanded={props.groupExpanded}
        unifiedView={data.unifiedView}
        recordVisibility={data.recordVisibility}
        visibilityHydrated={data.visibilityHydrated}
        crossAuthorEntries={data.crossAuthors}
      />
      {completion.showCompletionSurface && (
        <LeadSubmitReadinessSummary
          readiness={completion.readiness}
          onSubmit={props.writeActions.handleSubmit}
        />
      )}
    </>
  );
}

export function LeadFormLoaded(props: LeadFormLoadedProps) {
  const completion = useCompletionPresentation(props);
  const byPeriod = props.data.byPeriodData;
  if (!byPeriod) return null;

  return (
    <SdlcTooltipProvider>
      <form
        className={`space-y-6 ${completion.showStickyCompletion ? "pb-28" : ""}`}
        data-testid="lead-report-form"
      >
        <LoadedChrome
          props={props}
          completion={completion}
          submittedAt={byPeriod.section.submittedAt ?? null}
        />
        <LoadedReportContent
          props={props}
          completion={completion}
          serverSection={byPeriod.section}
        />
        {completion.showStickyCompletion && (
          <LeadStickyCompletionActions actions={completion.completionActions} />
        )}
      </form>
      <LeadFormDialogs
        viewModel={props.viewModel}
        quickAdd={props.draftActions}
        writeActions={props.writeActions}
        unsetOwnStageCount={props.unsetOwnStageCount}
        draftSection={props.draftSection}
      />
    </SdlcTooltipProvider>
  );
}
