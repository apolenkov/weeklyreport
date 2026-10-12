"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

// Fullscreened subtrees provide their own element so portaled surfaces stay
// inside the painted fullscreen root instead of escaping to document.body.
// undefined means no provider (fall back to body); a provider's null means
// the target element has not resolved yet.
const PortalTargetContext = createContext<HTMLElement | null | undefined>(
  undefined,
);

export function PortalTargetProvider({
  target,
  children,
}: {
  readonly target: HTMLElement | null;
  readonly children: ReactNode;
}) {
  return (
    <PortalTargetContext.Provider value={target}>
      {children}
    </PortalTargetContext.Provider>
  );
}

export function usePortalTarget(): HTMLElement | null | undefined {
  return useContext(PortalTargetContext);
}

const subscribe = (): (() => void) => () => undefined;
const getServerSnapshot = (): null => null;
const getDocumentBody = (): HTMLElement => document.body;

export function DocumentBodyPortal({
  children,
}: {
  readonly children: ReactNode;
}) {
  const override = useContext(PortalTargetContext);
  const body = useSyncExternalStore(
    subscribe,
    getDocumentBody,
    getServerSnapshot,
  );
  // A provider whose target is still pending must defer: portaling to body
  // for one commit escapes the fullscreen root, then remounts the surface.
  if (override === null) return null;
  const container = override ?? body;
  return container ? createPortal(children, container) : null;
}
