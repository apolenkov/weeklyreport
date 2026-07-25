import type { AutosaveState } from "../../../hooks/use-lead-form-autosave";

interface AutosaveCopy {
  readonly status: string;
  readonly readiness: string;
}

const AUTOSAVE_COPY: Record<AutosaveState, AutosaveCopy> = {
  idle: {
    status: "Draft saved",
    readiness: "Draft is saved.",
  },
  pending: {
    status: "Draft changes pending",
    readiness: "Draft changes are waiting to save.",
  },
  saving: {
    status: "Saving draft",
    readiness: "Draft changes are saving.",
  },
  saved: {
    status: "Draft saved",
    readiness: "Draft is saved.",
  },
  error: {
    status: "Draft save failed",
    readiness: "Draft save failed. Use Save to retry.",
  },
};

/**
 * Autosave Status Copy.
 * @param state - The state argument.
 */
export function autosaveStatusCopy(state: AutosaveState): string {
  return AUTOSAVE_COPY[state].status;
}

/**
 * Autosave Readiness Copy.
 * @param state - The state argument.
 */
export function autosaveReadinessCopy(state: AutosaveState): string {
  return AUTOSAVE_COPY[state].readiness;
}
