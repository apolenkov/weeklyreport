import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import type { SessionState, SessionUser } from "../../../lib/session-provider";

/** Session actors the data layer keys its gating and purge scoping on. */
export function deriveSessionActors(sessionState: SessionState | null): {
  sessionRole: SessionUser["role"] | null;
  currentUserId: string | null;
  shouldDeferForSession: boolean;
} {
  return {
    sessionRole: sessionState?.user?.role ?? null,
    currentUserId: sessionState?.user?.id ?? null,
    shouldDeferForSession: Boolean(sessionState?.isLoading),
  };
}

/** The active period's identifiers, empty until `getActive` resolves. */
export function deriveActiveIds(
  active: { reportId: string; reportSectionId: string } | null | undefined,
): { activeReportId: string; activeSectionId: string } {
  return {
    activeReportId: active?.reportId ?? "",
    activeSectionId: active?.reportSectionId ?? "",
  };
}

/**
 * 35-07: when the page renders under `/lead/report/[reportId]`, scope the
 * data load to the path-segment id rather than the session's active period.
 * This lets the lead view (and bookmark) any past week of their own history.
 */
export function deriveTargetReportId(
  pinnedReportId: string | undefined,
  activeReportId: string,
): string {
  return pinnedReportId && pinnedReportId !== ""
    ? pinnedReportId
    : activeReportId;
}

/**
 * slides-record-visibility (Decision 6): the slide deck can target another
 * author's deck via `?authorId`. On such a FOREIGN deck Everyone is not
 * offered — force the toolbar toggle to Mine and make it inert. The deck
 * (LeadSlidesClient) enforces the same own-deck gate independently, so this
 * is the matching toolbar affordance, not the security boundary.
 */
export function deriveDeckVisibility({
  isSlidesMode,
  slidesAuthorId,
  currentUserId,
  recordVisibility,
}: {
  readonly isSlidesMode: boolean;
  readonly slidesAuthorId: string | null;
  readonly currentUserId: string | null;
  readonly recordVisibility: RecordVisibility;
}): {
  isForeignSlidesDeck: boolean;
  toolbarVisibility: RecordVisibility;
} {
  const isForeignSlidesDeck =
    isSlidesMode && slidesAuthorId !== null && slidesAuthorId !== currentUserId;
  return {
    isForeignSlidesDeck,
    toolbarVisibility: isForeignSlidesDeck ? "mine" : recordVisibility,
  };
}
