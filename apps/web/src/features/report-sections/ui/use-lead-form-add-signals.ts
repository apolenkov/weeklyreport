"use client";

import { useState } from "react";

/**
 * The four "+ Add" UI signal counters for the lead form's section-hosted create
 * dialogs. Each bump opens the matching section's own editor (the section reads
 * the counter as an `addSignal` prop). These are pure UI open-triggers, not
 * draft state — kept out of the draft module so it owns only persisted content.
 */
export interface LeadFormAddSignals {
  readonly currentWeekAddSignal: number;
  readonly nextWeekAddSignal: number;
  readonly risksAddSignal: number;
  readonly decisionsAddSignal: number;
  readonly addCurrentWeekItem: () => void;
  readonly addNextWeekItem: () => void;
  readonly addRisk: () => void;
  readonly addDecision: () => void;
}

export function useLeadFormAddSignals(): LeadFormAddSignals {
  const [currentWeekAddSignal, setCurrentWeekAddSignal] = useState(0);
  const [nextWeekAddSignal, setNextWeekAddSignal] = useState(0);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [decisionsAddSignal, setDecisionsAddSignal] = useState(0);
  return {
    currentWeekAddSignal,
    nextWeekAddSignal,
    risksAddSignal,
    decisionsAddSignal,
    addCurrentWeekItem: () => setCurrentWeekAddSignal((value) => value + 1),
    addNextWeekItem: () => setNextWeekAddSignal((value) => value + 1),
    addRisk: () => setRisksAddSignal((value) => value + 1),
    addDecision: () => setDecisionsAddSignal((value) => value + 1),
  };
}
