import { isCompleteRisk } from "@weeklyreport/shared";

/** Risk details as a form or read model carries them. */
export interface RiskDetailText {
  readonly impact: string | null;
  readonly mitigation: string | null;
}

// The form keeps a cleared detail as an empty string; the draft save stores it
// as null. Both mean "missing".
const storedDetail = (value: string | null): string | null =>
  value === null || value.trim().length === 0 ? null : value;

/**
 * True when a risk may floor a status. A risk missing its impact or mitigation
 * is an author-private draft and floors nothing, on the form included.
 */
export const hasCompleteRiskDetails = (risk: RiskDetailText): boolean =>
  isCompleteRisk({
    impact: storedDetail(risk.impact),
    mitigation: storedDetail(risk.mitigation),
  });
