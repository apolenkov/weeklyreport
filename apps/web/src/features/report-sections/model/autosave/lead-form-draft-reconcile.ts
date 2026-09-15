import type { ReportSectionReadModel } from "@customreport/shared";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { DraftSaveContent } from "./autosave-types";
import type { SavedDraftRecordIdentity } from "./autosave-types";

type DraftRecord = Readonly<{
  id?: string | undefined;
  stableId?: string | undefined;
  nextStepText?: string | null | undefined;
}>;

type SectionItem = ReportSectionReadModel["items"][number];

export type ReseedTrigger =
  "unchanged" | "save-echo" | "external-clean" | "external-dirty";

export interface PendingSaveEcho {
  readonly persistedPayload: DraftSaveContent;
  readonly savedSection: ReportSectionReadModel;
  readonly serverDraftKey: string;
}

function itemIdentity(item: SectionItem): string | null {
  if (item.stableId) return `stable:${item.stableId}`;
  return item.id ? `id:${item.id}` : null;
}

function itemOutcomeMetadataKey(item: SectionItem): string {
  return encodeAutosaveComparisonKey({
    resolution: item.resolution,
    outcomeHistory: item.outcomeHistory,
  });
}

export function reconcileServerOutcomeMetadata(
  current: ReportSectionReadModel | null,
  serverSection: ReportSectionReadModel,
): ReportSectionReadModel | null {
  if (current?.reportSectionId !== serverSection.reportSectionId)
    return current;
  const serverItems = new Map(
    serverSection.items.flatMap((item) => {
      const identity = itemIdentity(item);
      return identity === null ? [] : [[identity, item] as const];
    }),
  );
  const items = current.items.map((item) => {
    const identity = itemIdentity(item);
    const serverItem =
      identity === null ? undefined : serverItems.get(identity);
    if (
      serverItem === undefined ||
      itemOutcomeMetadataKey(item) === itemOutcomeMetadataKey(serverItem)
    ) {
      return item;
    }
    return {
      ...item,
      resolution: serverItem.resolution,
      outcomeHistory: serverItem.outcomeHistory,
    };
  });
  return items.some((item, index) => item !== current.items[index])
    ? { ...current, items }
    : current;
}

function recordContentKey(record: DraftRecord): string {
  return encodeAutosaveComparisonKey(
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => key !== "id" && key !== "stableId",
      ),
    ),
  );
}

function findSavedRecord(
  record: DraftRecord,
  index: number,
  persisted: readonly DraftRecord[],
  saved: readonly DraftRecord[],
): DraftRecord | undefined {
  if (record.stableId) {
    return saved.find((candidate) => candidate.stableId === record.stableId);
  }
  const contentKey = recordContentKey(record);
  const occurrence = persisted
    .slice(0, index)
    .filter((candidate) => recordContentKey(candidate) === contentKey).length;
  return saved.filter(
    (candidate) => recordContentKey(candidate) === contentKey,
  )[occurrence];
}

export function savedRecordIdentityPairs(
  persisted: readonly DraftRecord[],
  saved: readonly DraftRecord[],
): readonly SavedDraftRecordIdentity[] {
  return persisted.flatMap((record, index) => {
    if (!record.id) return [];
    const confirmed = findSavedRecord(record, index, persisted, saved);
    if (!confirmed?.id) return [];
    return [
      {
        clientId: record.id,
        serverId: confirmed.id,
        stableId: confirmed.stableId ?? null,
        ...(record.nextStepText === undefined
          ? {}
          : { persistedNextStepText: record.nextStepText }),
      },
    ];
  });
}

function reconcileRecordIdentities<T extends DraftRecord>(
  current: readonly T[],
  persisted: readonly DraftRecord[],
  saved: readonly DraftRecord[],
): T[] {
  const identityByClientId = new Map(
    savedRecordIdentityPairs(persisted, saved).map((identity) => [
      identity.clientId,
      { id: identity.serverId, stableId: identity.stableId ?? undefined },
    ]),
  );
  return current.map((record) => {
    const confirmed = record.id ? identityByClientId.get(record.id) : undefined;
    return confirmed
      ? { ...record, id: confirmed.id, stableId: confirmed.stableId }
      : record;
  });
}

export function reconcileSavedIdentities(
  current: ReportSectionReadModel,
  saved: ReportSectionReadModel,
  persisted: DraftSaveContent,
): ReportSectionReadModel {
  const savedPayload = sectionToDraftPayload(saved);
  return {
    ...current,
    items: reconcileRecordIdentities(
      current.items,
      persisted.items,
      savedPayload.items,
    ),
    risks: reconcileRecordIdentities(
      current.risks,
      persisted.risks,
      savedPayload.risks,
    ),
    decisions: reconcileRecordIdentities(
      current.decisions,
      persisted.decisions,
      savedPayload.decisions,
    ),
  };
}

export function reconcileSavedPayloadIdentities(
  current: DraftSaveContent,
  saved: DraftSaveContent,
  persisted: DraftSaveContent,
): DraftSaveContent {
  if (current.reportSectionId !== saved.reportSectionId) return current;
  return {
    ...current,
    items: reconcileRecordIdentities(
      current.items,
      persisted.items,
      saved.items,
    ),
    risks: reconcileRecordIdentities(
      current.risks,
      persisted.risks,
      saved.risks,
    ),
    decisions: reconcileRecordIdentities(
      current.decisions,
      persisted.decisions,
      saved.decisions,
    ),
  };
}

export function classifyReseed(
  serverDraftKey: string,
  lastServerDraftKey: string | null,
  dirty: boolean,
  isSaveEcho: boolean,
): ReseedTrigger {
  if (serverDraftKey === lastServerDraftKey) return "unchanged";
  if (isSaveEcho) return "save-echo";
  return dirty ? "external-dirty" : "external-clean";
}
