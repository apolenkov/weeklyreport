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
  /** The draft-patch applier; a quick-add commit appends one week item. */
  readonly apply: (patch: DraftPatch) => void;
  /** Live loaded context, bridged into the post-commit save callback. */
  readonly loaded: LeadFormLoadedContext;
}

/**
 * The modal quick-add + blocker-prefill cluster: pending quick-add / risk
 * prefill signals plus the merge callback that appends the newly-authored item
 * to the current draft. Separated from the autosave/version/submit core because
 * it touches neither the optimistic-lock version nor the dual-state write path —
 * it only routes a modal gesture back through `apply`.
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
