"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface FullscreenHandle {
  readonly isFullscreen: boolean;
  readonly toggle: () => void;
}

// Which fullscreen transition rejected: entering (request) or exiting (exit).
export type FullscreenFailureKind = "request" | "exit";

// Single owner of a slide deck's fullscreen state and keyboard listener —
// deck surfaces must not register their own, or exit focus and the f-key
// guard fork.
export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
  focusOnExitRef?: RefObject<HTMLElement | null>,
  enabled = true,
  onFullscreenError?: (kind: FullscreenFailureKind, error: unknown) => void,
): FullscreenHandle {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasFullscreenRef = useRef(false);

  const toggle = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((error: unknown) => {
        // Denial without transient activation / in iframe contexts is expected,
        // but a genuine failure must stay observable through the callback.
        onFullscreenError?.("request", error);
      });
    } else {
      document.exitFullscreen().catch((error: unknown) => {
        onFullscreenError?.("exit", error);
      });
    }
  }, [targetRef, onFullscreenError]);

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
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey ||
        e.isComposing ||
        e.repeat ||
        e.defaultPrevented
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
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
