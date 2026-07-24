"use client";

import { useSyncExternalStore } from "react";

function subscribeHydrationStore() {
  return () => undefined;
}

export function useHydratedClient(): boolean {
  return useSyncExternalStore(
    subscribeHydrationStore,
    () => true,
    () => false,
  );
}
