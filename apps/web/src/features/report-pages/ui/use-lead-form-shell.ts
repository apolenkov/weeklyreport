"use client";

import { useRef } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import { useLeadFormData } from "./use-lead-form-data";

interface UseLeadFormShellInput {
  // Explicit report id from `[reportId]`; bare-route redirect on UseLeadFormDataInput.
  readonly pinnedReportId?: string;
  readonly redirectToCanonical?: boolean;
  readonly isSlidesMode: boolean;
}

// Queries, gating, purges, redirects and the slides deck refs. Called first
// from LeadForm so the hook order stays fixed.
/**
 * Use Lead Form Shell.
 * @param props - The props argument.
 */
export function useLeadFormShell({
  pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
}: UseLeadFormShellInput) {
  const data = useLeadFormData({
    reportId: pinnedReportId,
    redirectToCanonical,
    isSlidesMode,
  });
  // ref shared between lead-form header (SlideFullscreenButton) and
  // LeadSlidesClient (deck root div).
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  // Single fullscreen owner: threads toggle into toolbar + LeadSlidesClient
  // (local hook disabled) so one `f` listener exists; gated to slides mode.
  const slidesFullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    isSlidesMode,
  );
  return { data, deckRef, fullscreenToggleRef, slidesFullscreen };
}
