"use client";

// Single body portal so stage tooltips escape overflow:hidden inside collapsed accordions.

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

// Hydration gate without effect-driven state: server snapshot is false, client true.
const emptySubscribe = () => () => {
  /* nothing to unsubscribe — the hydration "store" never changes */
};
const useIsHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

interface TooltipState {
  content: string;
  top: number;
  left: number;
}

interface ContextValue {
  show: (rect: DOMRect, content: string) => void;
  hide: () => void;
}

const SdlcTooltipContext = createContext<ContextValue | null>(null);

const TOOLTIP_VERTICAL_GAP_PX = 8;

export function useSdlcTooltip(): ContextValue {
  const ctx = useContext(SdlcTooltipContext);
  if (!ctx) {
    // Graceful no-op when provider is absent (e.g. Storybook, unit tests
    // rendering StageChip in isolation).
    return {
      show: () => {
        /* intentionally empty: no-op when provider is absent (Storybook / unit tests) */
      },
      hide: () => {
        /* intentionally empty: no-op when provider is absent (Storybook / unit tests) */
      },
    };
  }
  return ctx;
}

export function SdlcTooltipProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [state, setState] = useState<TooltipState | null>(null);
  const mounted = useIsHydrated();

  const show = useCallback((rect: DOMRect, content: string) => {
    if (!content) return;
    const top = rect.top - TOOLTIP_VERTICAL_GAP_PX;
    const left = rect.left + rect.width / 2;
    setState({ content, top, left });
  }, []);

  const hide = useCallback(() => setState(null), []);

  const value = useMemo<ContextValue>(() => ({ show, hide }), [show, hide]);

  return (
    <SdlcTooltipContext.Provider value={value}>
      {children}
      {mounted && state
        ? createPortal(
            <div
              role="tooltip"
              data-testid="sdlc-tooltip"
              className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full whitespace-pre-line rounded-md bg-[var(--color-foreground)] px-2 py-1 text-left text-[11px] font-medium leading-relaxed text-white shadow-lg"
              style={{ top: state.top, left: state.left, maxWidth: 280 }}
            >
              {state.content}
            </div>,
            document.body,
          )
        : null}
    </SdlcTooltipContext.Provider>
  );
}
