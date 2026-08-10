"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { FullscreenHandle } from "../../../../../shared/hooks/browser/use-fullscreen";
import { SdlcTooltipProvider } from "../../../../../shared/ui/feedback/sdlc-tooltip";
import type { CrossAuthorEntry } from "../../../../period";
import type {
  CrossAuthorContentRow,
  LeadFormLoadedViewModel,
  LeadSubmitReadiness,
} from "../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../report-sections/client";
import type { RecordVisibility } from "../../../../report-sections/client";
import { LeadSlidesClient } from "../../../../slides";
import {
  LeadFormDialogs,
  type LeadFormDialogsQuickAdd,
  type LeadFormDialogsWriteActions,
} from "../chrome/lead-form-dialogs";
import {
  LeadFormEditSections,
  type LeadFormEditSectionsActions,
} from "../chrome/lead-form-edit-sections";
import {
  LeadFormHeaderActions,
  type LeadFormHeaderWriteActions,
} from "../chrome/lead-form-header-actions";
import { LeadFormPastPeriodBanner } from "../chrome/lead-form-past-period-banner";
import { LeadFormToolbarControls } from "../chrome/lead-form-toolbar-controls";
import { LeadStickyCompletionActions } from "../chrome/lead-sticky-completion-actions";
import { LeadSubmitReadinessSummary } from "../chrome/lead-submit-readiness-summary";
import type { QuickAddKind } from "../chrome/quick-add-button";
import { useHeaderActionsVisibility } from "../chrome/use-header-actions-visibility";

type LeadFormLoadedActions = LeadFormEditSectionsActions &
  LeadFormDialogsQuickAdd & {
    readonly onQuickAdd: (kind: QuickAddKind) => void;
  };
type LeadFormLoadedWriteActions = LeadFormHeaderWriteActions &
  LeadFormDialogsWriteActions & { readonly handleSubmit: () => void };

// Declared data-loading seam — not the hook's raw return type.
export interface LeadFormLoadedData {
  readonly byPeriodData:
    { readonly section: ReportSectionReadModel } | undefined;
  readonly toolbarVisibility: RecordVisibility;
  readonly setRecordVisibility: (next: RecordVisibility) => void;
  readonly isForeignSlidesDeck: boolean;
  readonly targetReportId: string | null;
  readonly activeReportId: string | null;
  readonly visibilityHydrated: boolean;
  readonly unifiedView: boolean;
  readonly recordVisibility: RecordVisibility;
  readonly crossAuthors: CrossAuthorEntry[];
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly foreignContentPending: boolean;
}

export interface LeadFormLoadedProps {
  readonly data: LeadFormLoadedData;
  readonly viewModel: LeadFormLoadedViewModel;
  readonly draftSection: ReportSectionReadModel;
  readonly autosave: AutosaveSnapshot;
  readonly submitReadiness: LeadSubmitReadiness;
  readonly draftActions: LeadFormLoadedActions;
  readonly writeActions: LeadFormLoadedWriteActions;
  readonly isSlidesMode: boolean;
  readonly isSubmitted: boolean;
  readonly pinnedReportId?: string | undefined;
  readonly showArchivePeriods: boolean;
  readonly setShowArchivePeriods: (next: boolean) => void;
  readonly groupExpanded: boolean;
  readonly setGroupExpanded: Dispatch<SetStateAction<boolean>>;
  readonly deckRef: RefObject<HTMLDivElement | null>;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly slidesFullscreen: FullscreenHandle;
  readonly unsetOwnStageCount: number;
}

interface CompletionPresentation {
  readonly completionActions: {
    readonly autosave: AutosaveSnapshot;
    readonly onAdd: (kind: QuickAddKind) => void;
    readonly addDisabled: boolean;
    readonly onSubmit: () => void;
    readonly submitDisabled: boolean;
    readonly submitDisabledReason: string | undefined;
  };
  readonly headerActionsVisible: boolean;
  readonly readiness: LeadSubmitReadiness;
  readonly sentinelRef: (node: HTMLDivElement | null) => void;
  readonly showCompletionSurface: boolean;
  readonly showStickyCompletion: boolean;
}

function useCompletionPresentation(
  props: LeadFormLoadedProps,
): CompletionPresentation {
  const { headerActionsVisible, sentinelRef } = useHeaderActionsVisibility();
  const readiness = props.submitReadiness;
  const completionActions = {
    autosave: props.autosave,
    onAdd: props.draftActions.onQuickAdd,
    addDisabled: props.viewModel.products.length === 0,
    // A blocker is a product-scoped risk; with no product to attach it to the
    // quick-add option is inert until the section gains one.
    disabledQuickAddKinds:
      props.viewModel.products.length === 0
        ? new Set<QuickAddKind>(["blocker"])
        : undefined,
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
        foreignContent={data.foreignContent}
        foreignContentPending={data.foreignContentPending}
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
        data-layout-key="report-page"
        data-layout-stability="position-width"
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
