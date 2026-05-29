"use client";

/**
 * Singleton tooltip portal for SDLC stage chips. Mirrors the mockup's
 * `#sdlc-tip` pattern: a single fixed-positioned element appended to
 * `document.body` so it can escape `overflow:hidden` clipping inside
 * collapsed accordion bodies.
 *
 * Usage:
 *   <SdlcTooltipProvider>
 *     <App />
 *     <SdlcTooltip />
 *   </SdlcTooltipProvider>
 *
 * Consumers (e.g. StageChip) call `useSdlcTooltip()` and invoke
 * `show(rect, content)` / `hide()` on hover events.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

type TooltipState = {
  content: string;
  top: number;
  left: number;
};

type ContextValue = {
  show: (rect: DOMRect, content: string) => void;
  hide: () => void;
};

const SdlcTooltipContext = createContext<ContextValue | null>(null);

export function useSdlcTooltip(): ContextValue {
  const ctx = useContext(SdlcTooltipContext);
  if (!ctx) {
    // Graceful no-op when provider is absent (e.g. Storybook, unit tests
    // rendering StageChip in isolation).
    return { show: () => {}, hide: () => {} };
  }
  return ctx;
}

export function SdlcTooltipProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [state, setState] = useState<TooltipState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const show = useCallback((rect: DOMRect, content: string) => {
    if (!content) return;
    // Position centered horizontally, just above the cell.
    const top = rect.top - 8;
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
              className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-md bg-[var(--color-foreground)] px-2 py-1 text-[11px] font-medium text-white shadow-lg"
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
