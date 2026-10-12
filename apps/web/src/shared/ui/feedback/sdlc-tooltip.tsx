"use client";

// Single body portal so stage tooltips escape overflow:hidden inside collapsed accordions.

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useHydratedClient } from "../../hooks/browser/use-hydrated-client";
import { DocumentBodyPortal } from "../dialogs/document-body-portal";

interface TooltipState {
  content: string;
  anchorRect: DOMRect;
  top: number;
  left: number;
  placement: "above" | "below";
}

interface ContextValue {
  show: (rect: DOMRect, content: string) => void;
  hide: () => void;
}

const SdlcTooltipContext = createContext<ContextValue | null>(null);

const TOOLTIP_VERTICAL_GAP_PX = 8;
const TOOLTIP_VIEWPORT_GAP_PX = 8;
const TOOLTIP_MAX_WIDTH_PX = 280;

interface TooltipSize {
  readonly width: number;
  readonly height: number;
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

function getTooltipPlacement(
  rect: DOMRect,
  height: number,
  viewportHeight: number,
): "above" | "below" {
  const aboveTop = rect.top - TOOLTIP_VERTICAL_GAP_PX;
  const belowTop = rect.bottom + TOOLTIP_VERTICAL_GAP_PX;
  const aboveFits =
    aboveTop - height >= TOOLTIP_VIEWPORT_GAP_PX || height === 0;
  const belowFits =
    belowTop + height <= viewportHeight - TOOLTIP_VIEWPORT_GAP_PX ||
    height === 0;
  if (!aboveFits && belowFits) return "below";
  if (!aboveFits && !belowFits && viewportHeight - rect.bottom > rect.top) {
    return "below";
  }
  return "above";
}

function clampTooltipTop(
  top: number,
  placement: "above" | "below",
  height: number,
  viewportHeight: number,
): number {
  if (height === 0 || viewportHeight === 0) return top;
  if (placement === "above") {
    return clamp(
      top,
      TOOLTIP_VIEWPORT_GAP_PX + height,
      viewportHeight - TOOLTIP_VIEWPORT_GAP_PX,
    );
  }
  return clamp(
    top,
    TOOLTIP_VIEWPORT_GAP_PX,
    viewportHeight - TOOLTIP_VIEWPORT_GAP_PX - height,
  );
}

function positionTooltip(rect: DOMRect, size: TooltipSize) {
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const centeredLeft = rect.left + rect.width / 2;
  const left =
    size.width > 0 && viewportWidth > 0
      ? clamp(
          centeredLeft,
          TOOLTIP_VIEWPORT_GAP_PX + size.width / 2,
          viewportWidth - TOOLTIP_VIEWPORT_GAP_PX - size.width / 2,
        )
      : centeredLeft;
  const placement = getTooltipPlacement(rect, size.height, viewportHeight);
  const top = clampTooltipTop(
    placement === "above"
      ? rect.top - TOOLTIP_VERTICAL_GAP_PX
      : rect.bottom + TOOLTIP_VERTICAL_GAP_PX,
    placement,
    size.height,
    viewportHeight,
  );

  return { top, left, placement };
}

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
  const mounted = useHydratedClient();
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback((rect: DOMRect, content: string) => {
    if (!content) return;
    setState({
      content,
      anchorRect: rect,
      ...positionTooltip(rect, { width: 0, height: 0 }),
    });
  }, []);

  const hide = useCallback(() => setState(null), []);

  const visible = state !== null;
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => setState(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [visible]);

  useEffect(() => {
    if (!state || !tooltipRef.current) return;
    const { width, height } = tooltipRef.current.getBoundingClientRect();
    const position = positionTooltip(state.anchorRect, {
      width: Math.min(width, TOOLTIP_MAX_WIDTH_PX),
      height,
    });
    if (
      position.top === state.top &&
      position.left === state.left &&
      position.placement === state.placement
    ) {
      return;
    }
    setState((current) =>
      current === state ? { ...current, ...position } : current,
    );
  }, [state]);

  const value = useMemo<ContextValue>(() => ({ show, hide }), [show, hide]);

  return (
    <SdlcTooltipContext.Provider value={value}>
      {children}
      {mounted && state ? (
        <DocumentBodyPortal>
          <div
            ref={tooltipRef}
            role="tooltip"
            data-testid="sdlc-tooltip"
            data-placement={state.placement}
            className={`pointer-events-none fixed z-[var(--layer-overlay)] -translate-x-1/2 whitespace-pre-line rounded-md bg-[var(--color-foreground)] px-2 py-1 text-left text-xs font-medium leading-relaxed text-[var(--color-on-dark)] shadow-lg ${state.placement === "above" ? "-translate-y-full" : "translate-y-0"}`}
            style={{
              top: state.top,
              left: state.left,
              maxWidth: TOOLTIP_MAX_WIDTH_PX,
            }}
          >
            {state.content}
          </div>
        </DocumentBodyPortal>
      ) : null}
    </SdlcTooltipContext.Provider>
  );
}
