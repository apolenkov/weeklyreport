import type { ReportSectionReadModel } from "@customreport/shared";

import { sectionToDraftPayload } from "../../report-sections";
import {
  type DraftSaveContent,
  encodeAutosaveComparisonKey,
} from "../../report-sections/client";

type DraftRecord = Readonly<{
  id?: string | undefined;
  stableId?: string | undefined;
}>;

export type ReseedTrigger =
  "unchanged" | "save-echo" | "external-clean" | "external-dirty";

export interface PendingSaveEcho {
  readonly persistedPayload: DraftSaveContent;
  readonly savedSection: ReportSectionReadModel;
  readonly serverDraftKey: string;
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
