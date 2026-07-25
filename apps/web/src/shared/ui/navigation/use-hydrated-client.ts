"use client";

import { useSyncExternalStore } from "react";

function subscribeHydrationStore() {
  return () => undefined;
}

/**
 * Use Hydrated Client.
 */
export function useHydratedClient(): boolean {
  return useSyncExternalStore(
    subscribeHydrationStore,
    () => true,
    () => false,
  );
}
