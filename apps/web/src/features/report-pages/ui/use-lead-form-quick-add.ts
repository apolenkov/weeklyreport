"use client";

import { useCallback } from "react";

import type { DraftPatch } from "./lead-form-draft-patch";
import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";
import type { RiskPrefillRequest } from "./lead-form-sync-bridge";
import { useGenerationState } from "./use-generation-state";

export interface QuickAddItem {
  readonly week: "current" | "next";
  readonly seq: number;
}

interface UseLeadFormQuickAddArgs {
  readonly apply: (patch: DraftPatch) => void;
  readonly loaded: LeadFormLoadedContext;
  readonly generation: LeadFormGeneration | null;
}

function useQuickAddState(generation: LeadFormGeneration | null) {
  const [pending, setPending] = useGenerationState<QuickAddItem | null>(
    generation,
    null,
  );
  const open = useCallback(
    (week: "current" | "next") => {
      setPending({ week, seq: (pending?.seq ?? 0) + 1 });
    },
    [pending?.seq, setPending],
  );
  const clear = useCallback(() => setPending(null), [setPending]);
  return { pending, open, clear };
}

function useRiskPrefillState(generation: LeadFormGeneration | null) {
  const [pending, setPending] = useGenerationState<RiskPrefillRequest | null>(
    generation,
    null,
  );
  const open = useCallback(
    (prefill: Omit<RiskPrefillRequest, "signal">) => {
      setPending({ signal: (pending?.signal ?? 0) + 1, ...prefill });
    },
    [pending?.signal, setPending],
  );
  const clear = useCallback(() => setPending(null), [setPending]);
  return { pending, open, clear };
}

// Modal quick-add only routes through `apply` — not version/dual-state writes.
export function useLeadFormQuickAdd({
  apply,
  loaded,
  generation,
}: UseLeadFormQuickAddArgs) {
  const quickAdd = useQuickAddState(generation);
  const riskPrefill = useRiskPrefillState(generation);
  const quickAddSave = useCallback(
    (item: LeadFormLoadedContext["currentWeekItems"][number]) => {
      if (!quickAdd.pending) return;
      const week = quickAdd.pending.week;
      const base =
        week === "next" ? loaded.nextWeekItems : loaded.currentWeekItems;
      apply({ kind: "week-items", week, items: [...base, item] });
      quickAdd.clear();
    },
    [apply, loaded, quickAdd],
  );
  return {
    quickAdd: quickAdd.open,
    pendingQuickAdd: quickAdd.pending,
    quickAddSave,
    clearQuickAdd: quickAdd.clear,
    routeToBlocker: riskPrefill.open,
    pendingRiskPrefill: riskPrefill.pending,
    clearRiskPrefill: riskPrefill.clear,
  };
}
