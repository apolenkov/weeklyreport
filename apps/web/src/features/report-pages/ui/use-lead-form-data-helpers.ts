import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import type { SessionState, SessionUser } from "../../../lib/session-provider";

/**
 * Derive Session Actors.
 * @param sessionState - The sessionState argument.
 */
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

/**
 * Derive Active Ids.
 * @param active - The active argument.
 */
export function deriveActiveIds(
  active: { reportId: string; reportSectionId: string } | null | undefined,
): { activeReportId: string; activeSectionId: string } {
  return {
    activeReportId: active?.reportId ?? "",
    activeSectionId: active?.reportSectionId ?? "",
  };
}

// Prefer path-segment reportId so a lead can view/bookmark past weeks.
/**
 * Derive Target Report Id.
 * @param pinnedReportId - The pinnedReportId argument.
 * @param activeReportId - The activeReportId argument.
 */
export function deriveTargetReportId(
  pinnedReportId: string | undefined,
  activeReportId: string,
): string {
  return pinnedReportId && pinnedReportId !== ""
    ? pinnedReportId
    : activeReportId;
}

// Foreign ?authorId deck: force Mine on the toolbar; deck enforces its own gate.
/**
 * Derive Deck Visibility.
 * @param options - The options argument.
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
