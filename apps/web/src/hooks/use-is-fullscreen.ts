"use client";

import { useEffect, useState } from "react";

/**
 * Shared DOM source of truth for "is the document in fullscreen".
 *
 * Reads `document.fullscreenElement` and subscribes to `fullscreenchange`, so
 * multiple components (the slide fullscreen toggle AND the slide hero controls)
 * observe the same fullscreen state without prop-drilling or lifting state into
 * a common parent. Extracted from `SlideFullscreenButton`'s former private
 * state so `LeadSlidesClient` can gate presentation-only chrome on it.
 */
export function useIsFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    // Sync once on mount in case we mounted while already fullscreen.
    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  return isFullscreen;
}
