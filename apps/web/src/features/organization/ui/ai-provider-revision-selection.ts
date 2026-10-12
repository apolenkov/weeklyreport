import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@weeklyreport/shared";
import { type Dispatch, type SetStateAction, useState } from "react";

const WORKING_LIFECYCLES: ReadonlySet<
  AiProviderConfigurationRead["lifecycle"]
> = new Set(["draft", "validated", "preparing", "failed"] as const);

const latestWorkingRevision = (
  revisions: AiProviderControlRead["revisions"],
): AiProviderConfigurationRead | null =>
  revisions.reduce<AiProviderConfigurationRead | null>((latest, revision) => {
    if (!WORKING_LIFECYCLES.has(revision.lifecycle)) return latest;
    if (!latest || revision.updatedAt > latest.updatedAt) return revision;
    return latest;
  }, null);

const latestPreparingRevision = (
  revisions: AiProviderControlRead["revisions"],
): AiProviderConfigurationRead | null =>
  revisions.reduce<AiProviderConfigurationRead | null>((latest, revision) => {
    if (revision.lifecycle !== "preparing") return latest;
    if (!latest || revision.updatedAt > latest.updatedAt) return revision;
    return latest;
  }, null);

const selectDisplayedRevision = (
  data: AiProviderControlRead,
): AiProviderControlRead["active"] => {
  const preparing = latestPreparingRevision(data.revisions);
  if (preparing) return preparing;
  const draft = latestWorkingRevision(data.revisions);
  if (!draft || (data.active && draft.updatedAt <= data.active.updatedAt)) {
    return data.active;
  }
  return draft;
};

// The just-saved pin exists to bridge the optimistic window until the control
// read refetches. Once a fetch that started after the save has landed and the
// revision is still absent, it was deleted elsewhere — the pin is stale and
// must not keep resurrecting a phantom revision.
type SavedRevisionPin = Readonly<{
  revision: AiProviderConfigurationRead;
  savedAt: number;
}>;

// Holds the just-saved pin and retires it once a post-save refetch confirms
// the revision is gone (external discard / bounded history window).
export const useSavedRevisionPin = (
  data: AiProviderControlRead | undefined,
  dataUpdatedAt: number,
): {
  savedRevision: AiProviderConfigurationRead | null;
  setSavedRevision: Dispatch<
    SetStateAction<AiProviderConfigurationRead | null>
  >;
} => {
  const [pin, setPin] = useState<SavedRevisionPin | null>(null);
  const setSavedRevision: Dispatch<
    SetStateAction<AiProviderConfigurationRead | null>
  > = (next) =>
    setPin((previous) => {
      const value =
        typeof next === "function" ? next(previous?.revision ?? null) : next;
      return value === null ? null : { revision: value, savedAt: Date.now() };
    });
  const savedRevision =
    pin !== null &&
    data !== undefined &&
    savedRevisionIsStale(data, pin.revision, dataUpdatedAt, pin.savedAt)
      ? null
      : (pin?.revision ?? null);
  return { savedRevision, setSavedRevision };
};

export const savedRevisionIsStale = (
  data: AiProviderControlRead,
  savedRevision: AiProviderConfigurationRead,
  dataUpdatedAt: number,
  savedAt: number,
): boolean =>
  dataUpdatedAt > savedAt &&
  !data.revisions.some(({ id }) => id === savedRevision.id);

export const selectObservedRevision = (
  data: AiProviderControlRead,
  savedRevision: AiProviderConfigurationRead | null,
): AiProviderConfigurationRead | null => {
  const preparing = latestPreparingRevision(data.revisions);
  if (preparing) return preparing;
  if (!savedRevision) return selectDisplayedRevision(data);
  return (
    data.revisions.find(({ id }) => id === savedRevision.id) ?? savedRevision
  );
};
