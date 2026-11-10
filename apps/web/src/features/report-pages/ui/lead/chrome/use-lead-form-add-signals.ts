"use client";

import { useState } from "react";

/** The Product or Activity a new decision starts in when raised from its unit. */
export interface DecisionSeed {
  readonly productId?: string | undefined;
  readonly activityId?: string | undefined;
}

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
  /** Null after the section's own "Add decision": the default parent applies. */
  readonly decisionSeed: DecisionSeed | null;
  readonly addDecisionFor: (seed: DecisionSeed) => void;
}

export function useLeadFormAddSignals(): LeadFormAddSignals {
  const [currentWeekAddSignal, setCurrentWeekAddSignal] = useState(0);
  const [nextWeekAddSignal, setNextWeekAddSignal] = useState(0);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [decisionsAddSignal, setDecisionsAddSignal] = useState(0);
  const [decisionSeed, setDecisionSeed] = useState<DecisionSeed | null>(null);
  return {
    currentWeekAddSignal,
    nextWeekAddSignal,
    risksAddSignal,
    decisionsAddSignal,
    addCurrentWeekItem: () => setCurrentWeekAddSignal((value) => value + 1),
    addNextWeekItem: () => setNextWeekAddSignal((value) => value + 1),
    addRisk: () => setRisksAddSignal((value) => value + 1),
    addDecision: () => {
      setDecisionSeed(null);
      setDecisionsAddSignal((value) => value + 1);
    },
    decisionSeed,
    addDecisionFor: (seed) => {
      setDecisionSeed(seed);
      setDecisionsAddSignal((value) => value + 1);
    },
  };
}
