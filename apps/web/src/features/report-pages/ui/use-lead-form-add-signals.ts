"use client";

import { useState } from "react";

// UI open-triggers only — kept out of the draft module (persisted content).
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
