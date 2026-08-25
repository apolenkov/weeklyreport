"use client";

import { useRef, useState } from "react";

import { useFullscreen } from "../../../../../shared/hooks/browser/use-fullscreen";
import type { SlideDensity } from "../../../../slides";
import { useLeadFormData } from "./use-lead-form-data";

interface UseLeadFormShellInput {
  // Explicit report id from `[reportId]`; bare-route redirect on UseLeadFormDataInput.
  readonly pinnedReportId?: string | undefined;
  readonly redirectToCanonical?: boolean | undefined;
  readonly isSlidesMode: boolean;
}

// Queries, gating, purges, redirects and the slides deck refs. Called first
// from LeadForm so the hook order stays fixed.
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
  // Hosted slides keep density in the report context toolbar; standalone
  // LeadSlidesClient owns its local fallback state.
  const [density, setDensity] = useState<SlideDensity>("document");
  // Single fullscreen owner: threads toggle into toolbar + LeadSlidesClient
  // (local hook disabled) so one `f` listener exists; gated to slides mode.
  const slidesFullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    isSlidesMode,
  );
  return {
    data,
    deckRef,
    density,
    fullscreenToggleRef,
    setDensity,
    slidesFullscreen,
  };
}
