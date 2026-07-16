"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * add-slide-fullscreen-exit-affordance: the SINGLE owner of a slide deck's
 * fullscreen state. Call it ONCE per deck container (always mounted) so each
 * deck has exactly one `f` keydown owner and one `fullscreenchange`
 * subscription — adding a second visible exit control (the floating pill) then
 * never double-toggles.
 *
 * @param targetRef the element to request fullscreen on.
 * @param focusOnExitRef the STABLE control to focus when fullscreen ends — the
 *   lead's persistent toolbar toggle, or the head deck article (`tabIndex=-1`).
 *   NEVER the floating pill, which unmounts when fullscreen ends.
 * @param enabled when false the hook registers NO listeners (lead-form owns the
 *   hook on the hosted path, so the hosted `LeadSlidesClient` passes
 *   `enabled=false` to avoid a second listener). State is driven from the
 *   native event, never a local guess.
 */
/** The fullscreen handle consumers receive: current state + one toggle. */
export interface FullscreenHandle {
  readonly isFullscreen: boolean;
  readonly toggle: () => void;
}

export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
  focusOnExitRef?: RefObject<HTMLElement | null>,
  enabled = true,
): FullscreenHandle {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasFullscreenRef = useRef(false);

  const toggle = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        /* ignore — denied without transient activation / in iframe contexts */
      });
    } else {
      document.exitFullscreen().catch(() => {
        /* ignore */
      });
    }
  }, [targetRef]);

  useEffect(() => {
    if (!enabled) return;
    function onFullscreenChange() {
      const next = !!document.fullscreenElement;
      setIsFullscreen(next);
      // On the transition OUT of fullscreen, return focus to a stable control so
      // keyboard users are not stranded on the now-unmounted floating pill.
      if (wasFullscreenRef.current && !next) focusOnExitRef?.current?.focus();
      wasFullscreenRef.current = next;
    }
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "f" || e.key === "F") toggle();
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [toggle, enabled, focusOnExitRef]);

  return { isFullscreen, toggle };
}
