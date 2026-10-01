"use client";

import { WifiOff } from "lucide-react";

import { useIsOnline } from "../../../../../shared/lib/query/use-is-online";
import { OFFLINE_SAVING_STATUS } from "./autosave-state-copy";

// Header twin of the Overview's offline status; pages that announce autosave
// in their own live region skip it.
export function OfflineSaveNotice({ saving }: { readonly saving: boolean }) {
  const online = useIsOnline();
  if (online || !saving) return null;
  return (
    <span
      role="alert"
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-status-blocked-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-destructive)]"
    >
      <WifiOff aria-hidden="true" className="size-3" />
      {OFFLINE_SAVING_STATUS}
    </span>
  );
}
