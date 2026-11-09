import type {
  AutosaveRequest,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";

export function currentSaveRequest(
  args: UseLeadFormAutosaveArgs,
  activation: {
    generation: symbol;
    version: number;
  },
): AutosaveRequest | null {
  if (!args.enabled || args.payload === null) return null;
  if (args.payload.reportSectionId !== args.reportSectionId) return null;
  return draftSaveRequest(
    activation,
    encodeDraftSaveComparisonKey(args.payload),
    args.payload,
  );
}

export function draftSaveRequest(
  activation: { generation: symbol; version: number },
  key: string,
  payload: DraftSaveContent,
): AutosaveRequest {
  return {
    generation: activation.generation,
    version: activation.version,
    key,
    payload,
  };
}
