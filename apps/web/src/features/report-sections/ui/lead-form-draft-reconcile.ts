import type { ReportSectionReadModel } from "@customreport/shared";

import {
  type DraftSaveContent,
  stableStringify,
} from "../../../hooks/use-lead-form-autosave";
import { sectionToDraftPayload } from "../model/lead-section-draft-payload";

type DraftRecord = Readonly<{ id?: string; stableId?: string }>;

export type ReseedTrigger =
  | "unchanged"
  | "save-echo"
  | "external-clean"
  | "external-dirty";

export interface PendingSaveEcho {
  readonly persistedPayload: DraftSaveContent;
  readonly savedSection: ReportSectionReadModel;
  readonly serverDraftKey: string;
}

/** Compares record content without transport and durable identity fields. */
function recordContentKey(record: DraftRecord): string {
  return stableStringify(
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => key !== "id" && key !== "stableId",
      ),
    ),
  );
}

/** Finds the saved counterpart for one persisted record, including duplicates. */
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

/** Replaces only identities from the confirmed save, preserving current content. */
function reconcileRecordIdentities<T extends DraftRecord>(
  current: readonly T[],
  persisted: readonly DraftRecord[],
  saved: readonly DraftRecord[],
): T[] {
  const identityByClientId = new Map(
    persisted.flatMap((record, index) => {
      const confirmed = findSavedRecord(record, index, persisted, saved);
      return record.id && confirmed ? [[record.id, confirmed] as const] : [];
    }),
  );
  return current.map((record) => {
    const confirmed = record.id ? identityByClientId.get(record.id) : undefined;
    return confirmed
      ? { ...record, id: confirmed.id, stableId: confirmed.stableId }
      : record;
  });
}

/** Reconciles identities for every delete-and-recreate record collection. */
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

/** Classifies an incoming server payload before the orchestration effect acts. */
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
