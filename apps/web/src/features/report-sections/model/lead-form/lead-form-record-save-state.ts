import type { ReportSectionReadModel } from "@weeklyreport/shared";

import type {
  AutosaveRecovery,
  AutosaveSnapshot,
} from "../autosave/autosave-types";
import type { MappedLeadForm } from "../lead-form";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { DraftRecordSaveState } from "../types";

export interface DraftPersistenceEvidence {
  readonly autosave: AutosaveSnapshot;
  readonly recovery: AutosaveRecovery | null;
}

function saveState(evidence: DraftPersistenceEvidence): DraftRecordSaveState {
  const { autosave, recovery } = evidence;
  if (recovery?.phase === "ambiguous") return "uncertain";
  if (recovery?.phase === "reconciliation") return "error";
  if (autosave.isInFlight || recovery?.phase === "pending") return "pending";
  if (autosave.currentPayloadMatchesSavedBaseline) return "saved";
  if (autosave.state === "error")
    return autosave.lastFailureKind === "uncertain" ? "uncertain" : "error";
  if (
    autosave.state === "pending" ||
    autosave.state === "saving" ||
    autosave.dirty
  )
    return "pending";
  return "local";
}

// Only the existing save owner can confirm a baseline. Payload membership
// prevents a filtered local row from borrowing the rest of the form's proof.
export function withDraftRecordSaveStates(
  data: MappedLeadForm,
  section: ReportSectionReadModel,
  evidence: DraftPersistenceEvidence | undefined,
): MappedLeadForm {
  if (!evidence) return data;
  const payload = sectionToDraftPayload(section);
  const riskIds = new Set(payload.risks.map((row) => row.id));
  const decisionIds = new Set(payload.decisions.map((row) => row.id));
  const state = saveState(evidence);
  return {
    ...data,
    risks: data.risks.map((row) => ({
      ...row,
      draftSaveState: riskIds.has(row.id) ? state : "local",
    })),
    decisions: data.decisions.map((row) => ({
      ...row,
      draftSaveState: decisionIds.has(row.id) ? state : "local",
    })),
  };
}
