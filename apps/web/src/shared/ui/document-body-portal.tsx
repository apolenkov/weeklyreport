"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = (): (() => void) => () => undefined;
const getServerSnapshot = (): null => null;
const getDocumentBody = (): HTMLElement => document.body;

export function DocumentBodyPortal({
  children,
}: {
  readonly children: ReactNode;
}) {
  const container = useSyncExternalStore(
    subscribe,
    getDocumentBody,
    getServerSnapshot,
  );
  return container ? createPortal(children, container) : null;
}
