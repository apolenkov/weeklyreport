"use client";

import { useCallback, useRef, useState } from "react";

import type { DraftPatch } from "./lead-form-draft-patch";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import type { RiskPrefillRequest } from "./lead-form-sync-bridge";

export interface QuickAddItem {
  readonly week: "current" | "next";
  readonly seq: number;
}

interface UseLeadFormQuickAddArgs {
  readonly apply: (patch: DraftPatch) => void;
  readonly loaded: LeadFormLoadedContext;
}

// Modal quick-add only routes through `apply` — not version/dual-state writes.
/**
 * Use Lead Form Quick Add.
 * @param props - The props argument.
 */
export function useLeadFormQuickAdd({
  apply,
  loaded,
}: UseLeadFormQuickAddArgs) {
  const [pendingQuickAdd, setPendingQuickAdd] = useState<QuickAddItem | null>(
    null,
  );
  const [pendingRiskPrefill, setPendingRiskPrefill] =
    useState<RiskPrefillRequest | null>(null);

  // The one sanctioned render->callback bridge: the live loaded context a
  // quick-add merge callback reads after commit.
  const loadedRef = useRef(loaded);
  // eslint-disable-next-line react-hooks/refs -- the one sanctioned render->callback bridge (see comment above)
  loadedRef.current = loaded;

  const routeToBlocker = useCallback(
    (prefill: Omit<RiskPrefillRequest, "signal">) => {
      setPendingRiskPrefill((prev) => ({
        signal: (prev?.signal ?? 0) + 1,
        ...prefill,
      }));
    },
    [],
  );

  const quickAdd = useCallback((week: "current" | "next") => {
    setPendingQuickAdd((prev) => ({ week, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  const clearQuickAdd = useCallback(() => setPendingQuickAdd(null), []);
  const clearRiskPrefill = useCallback(() => setPendingRiskPrefill(null), []);

  const quickAddSave = useCallback(
    (item: LeadFormLoadedContext["currentWeekItems"][number]) => {
      if (!pendingQuickAdd) return;
      const context = loadedRef.current;
      const week = pendingQuickAdd.week;
      const base =
        week === "next" ? context.nextWeekItems : context.currentWeekItems;
      apply({ kind: "week-items", week, items: [...base, item] });
      setPendingQuickAdd(null);
    },
    [pendingQuickAdd, apply],
  );

  return {
    quickAdd,
    pendingQuickAdd,
    quickAddSave,
    clearQuickAdd,
    routeToBlocker,
    pendingRiskPrefill,
    clearRiskPrefill,
  };
}
