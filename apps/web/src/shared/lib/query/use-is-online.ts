"use client";

import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

// TanStack pauses mutations while `onlineManager` is offline, so this is the
// signal that explains a save that never leaves the browser.
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
    () => true,
  );
}
