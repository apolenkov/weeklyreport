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
const PortalTargetContext = createContext<HTMLElement | null>(null);

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

export function usePortalTarget(): HTMLElement | null {
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
  const container = override ?? body;
  return container ? createPortal(children, container) : null;
}
