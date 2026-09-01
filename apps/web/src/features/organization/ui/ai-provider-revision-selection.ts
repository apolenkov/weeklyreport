import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@customreport/shared";

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
