import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { AutosaveRequest, DraftSaveContent } from "./autosave-types";
import type { SavedDraftRecordIdentity } from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";

type DraftRecord = Readonly<{
  id?: string | undefined;
  stableId?: string | undefined;
  nextStepText?: string | null | undefined;
}>;

type SectionItem = ReportSectionReadModel["items"][number];
type SectionRisk = ReportSectionReadModel["risks"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];
type SectionRecord = SectionItem | SectionRisk | SectionDecision;

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

// Reviewer feedback arrives on a record without moving the section version, so a
// refetch that produces the same draft payload still has to refresh it — the
// lead surface renders comments from the draft, not from the server copy.
function commentsKey(comments: SectionRecord["comments"]): string {
  return encodeAutosaveComparisonKey(comments ?? []);
}

function mergeServerComments<T extends SectionRecord>(
  current: readonly T[],
  server: readonly T[],
): readonly T[] {
  if (current.length === 0) return current;
  const serverItems = new Map<string, T>();
  for (const record of server) {
    const identity = itemIdentity(record as SectionItem);
    if (identity !== null) serverItems.set(identity, record);
  }
  const merged = current.map((record) => {
    const identity = itemIdentity(record as SectionItem);
    const serverRecord =
      identity === null ? undefined : serverItems.get(identity);
    if (
      serverRecord?.comments === undefined ||
      commentsKey(serverRecord.comments) === commentsKey(record.comments)
    ) {
      return record;
    }
    return { ...record, comments: serverRecord.comments };
  });
  return merged.some((record, index) => record !== current[index])
    ? merged
    : current;
}

function itemMetadataKey(
  item: SectionItem,
  comments: SectionItem["comments"] = item.comments,
): string {
  return encodeAutosaveComparisonKey({
    resolution: item.resolution,
    outcomeHistory: item.outcomeHistory,
    comments: comments ?? [],
  });
}

export function reconcileServerRecordMetadata(
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
    if (serverItem === undefined) return item;
    // An absent `comments` key means the server projection does not carry
    // reviewer feedback; keeping the draft's array avoids clearing it.
    const comments = serverItem.comments ?? item.comments;
    if (itemMetadataKey(serverItem, comments) === itemMetadataKey(item)) {
      return item;
    }
    return {
      ...item,
      resolution: serverItem.resolution,
      outcomeHistory: serverItem.outcomeHistory,
      comments,
    };
  });
  const risks = mergeServerComments(current.risks, serverSection.risks);
  const decisions = mergeServerComments(
    current.decisions,
    serverSection.decisions,
  );
  const itemsChanged = items.some(
    (item, index) => item !== current.items[index],
  );
  return itemsChanged ||
    risks !== current.risks ||
    decisions !== current.decisions
    ? { ...current, items, risks, decisions }
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

// Re-keys a queued save against freshly confirmed server identities so the
// drain writes the merged content, not the stale pre-save rows. Returns null
// when the queue no longer belongs to the save's activation.
export function reconcileQueuedRequest(
  queued: AutosaveRequest | null,
  generation: symbol,
  saved: ReportSectionReadModel,
  persistedPayload: DraftSaveContent,
): AutosaveRequest | null {
  if (queued?.generation !== generation) return null;
  return rebaseQueuedRequest(
    queued,
    reconcileSavedPayloadIdentities(
      queued.payload,
      sectionToDraftPayload(saved),
      persistedPayload,
    ),
    saved.version,
  );
}

// Rebuilds a queued request with a rebased payload; a null payload drops the
// queue entry entirely.
export function rebaseQueuedRequest(
  queued: AutosaveRequest,
  next: DraftSaveContent | null,
  savedVersion: number,
): AutosaveRequest | null {
  if (next === null) return null;
  return {
    ...queued,
    payload: next,
    key: encodeDraftSaveComparisonKey(next),
    version: Math.max(queued.version, savedVersion),
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
