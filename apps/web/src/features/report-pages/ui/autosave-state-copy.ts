import type { AutosaveState } from "../../report-sections/client";

interface AutosaveCopy {
  readonly status: string;
  readonly readiness: string;
}

// idle and saved share the same copy; one value so they cannot drift apart.
const SAVED_COPY: AutosaveCopy = {
  status: "Draft saved",
  readiness: "Draft is saved.",
};

const AUTOSAVE_COPY: Record<AutosaveState, AutosaveCopy> = {
  idle: SAVED_COPY,
  pending: {
    status: "Draft changes pending",
    readiness: "Draft changes are waiting to save.",
  },
  saving: {
    status: "Saving draft",
    readiness: "Draft changes are saving.",
  },
  saved: SAVED_COPY,
  error: {
    status: "Draft save failed",
    readiness: "Draft save failed. Use Save to retry.",
  },
};

export function autosaveStatusCopy(state: AutosaveState): string {
  return AUTOSAVE_COPY[state].status;
}

export function autosaveReadinessCopy(state: AutosaveState): string {
  return AUTOSAVE_COPY[state].readiness;
}
