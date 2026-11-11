"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import {
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { AutosaveRequest, DraftSaveContent } from "./autosave-types";
import {
  captureUnfinishedRecords,
  overlayUnfinishedRecords,
  type RetainedDraftRecords,
} from "./conflict-retained-records";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  sectionRevision,
  type SetDraftSection,
} from "./use-server-section-reseed";

// Server sections kept to resolve the base revision of a conflicting save.
const SECTION_HISTORY_LIMIT = 8;

interface RetainedEdits {
  readonly base: ReportSectionReadModel;
  readonly attempted: DraftSaveContent;
  readonly awaitingNewer: boolean;
  readonly records: RetainedDraftRecords;
  readonly reportSectionId: string;
  readonly baseVersion: number;
  readonly texts: ReadonlyMap<string, string>;
}

// Only the item texts the Lead changed relative to the revision the failed save
// was based on; anything else in the stale payload is not the Lead's edit.
function changedItemTexts(
  payload: DraftSaveContent,
  base: ReportSectionReadModel,
): Map<string, string> {
  const baseTexts = new Map(
    base.items.map((item) => [item.stableId, item.text]),
  );
  const changed = new Map<string, string>();
  for (const item of payload.items) {
    const baseText = item.stableId ? baseTexts.get(item.stableId) : undefined;
    if (item.stableId && baseText !== undefined && baseText !== item.text)
      changed.set(item.stableId, item.text);
  }
  return changed;
}

function overlayItemTexts(
  section: ReportSectionReadModel,
  texts: ReadonlyMap<string, string>,
): ReportSectionReadModel {
  const textOf = (id: string | undefined) =>
    id === undefined ? undefined : texts.get(id);
  if (!section.items.some((item) => textOf(item.stableId) !== undefined))
    return section;
  return {
    ...section,
    items: section.items.map((item) => {
      const text = textOf(item.stableId);
      return text === undefined ? item : { ...item, text };
    }),
  };
}

function retainedAppliesTo(
  retained: RetainedEdits | null,
  section: ReportSectionReadModel | null,
): retained is RetainedEdits {
  return (
    retained?.reportSectionId === section?.reportSectionId &&
    retained !== null &&
    section !== null &&
    section.version >= retained.baseVersion
  );
}

function rememberSection(
  history: Map<string, ReportSectionReadModel>,
  section: ReportSectionReadModel,
): void {
  history.set(sectionRevision(section), section);
  const oldest = history.keys().next().value;
  if (history.size > SECTION_HISTORY_LIMIT && oldest !== undefined)
    history.delete(oldest);
}

function usePendingConflictInput({
  acceptedVersion,
  serverSection,
  payload,
  payloadKey,
  retainedRef,
  heldKeyRef,
  setHeldKey,
}: {
  acceptedVersion: number;
  serverSection: ReportSectionReadModel | null | undefined;
  payload: DraftSaveContent | null;
  payloadKey: string | null;
  retainedRef: RefObject<RetainedEdits | null>;
  heldKeyRef: RefObject<string | null>;
  setHeldKey: (key: string | null) => void;
}) {
  // Editing is reconciliation only after the newer base has arrived. Until
  // then the existing hold follows the latest input through the pending read.
  useEffect(() => {
    const retained = retainedRef.current;
    if (
      retained &&
      serverSection?.reportSectionId === retained.reportSectionId &&
      serverSection.version > retained.baseVersion &&
      serverSection.version >= acceptedVersion &&
      encodeDraftSaveComparisonKey(sectionToDraftPayload(serverSection)) ===
        payloadKey
    ) {
      retainedRef.current = null;
      heldKeyRef.current = null;
      setHeldKey(null);
      return;
    }
    if (payloadKey === heldKeyRef.current) return;
    if (
      retained &&
      (retained.awaitingNewer || heldKeyRef.current === null) &&
      payload?.reportSectionId === retained.reportSectionId
    ) {
      retainedRef.current = {
        ...retained,
        texts: changedItemTexts(payload, retained.base),
        records: captureUnfinishedRecords(
          payload,
          retained.base,
          retained.attempted,
          retained.records,
        ),
      };
      if (heldKeyRef.current !== null) {
        heldKeyRef.current = payloadKey;
        setHeldKey(payloadKey);
      }
      return;
    }
    retainedRef.current = null;
    heldKeyRef.current = null;
    setHeldKey(null);
  }, [
    acceptedVersion,
    serverSection,
    payloadKey,
    payload,
    retainedRef,
    heldKeyRef,
    setHeldKey,
  ]);
}

function awaitingReadFor(retained: RetainedEdits | null, sectionId: string) {
  return retained?.awaitingNewer && retained.reportSectionId === sectionId
    ? retained
    : null;
}

function capturedEdits(
  failed: AutosaveRequest,
  current: DraftSaveContent | null,
  base: ReportSectionReadModel | undefined,
  previous: RetainedEdits | null,
): RetainedEdits | null {
  const { reportSectionId } = failed.payload;
  const texts =
    base && current?.reportSectionId === reportSectionId
      ? changedItemTexts(current, base)
      : new Map<string, string>();
  const records =
    base && current?.reportSectionId === reportSectionId
      ? captureUnfinishedRecords(
          current,
          base,
          failed.payload,
          previous?.records,
        )
      : { risks: [], decisions: [] };
  return base &&
    (texts.size > 0 || records.risks.length > 0 || records.decisions.length > 0)
    ? {
        reportSectionId,
        baseVersion: failed.version,
        texts,
        records,
        base,
        attempted: failed.payload,
        awaitingNewer: true,
      }
    : null;
}

function latestSection(
  history: Map<string, ReportSectionReadModel>,
  reportSectionId: string,
) {
  return [...history.values()]
    .filter((section) => section.reportSectionId === reportSectionId)
    .reduce<ReportSectionReadModel | undefined>(
      (latest, section) =>
        !latest || section.version > latest.version ? section : latest,
      undefined,
    );
}

function useObservedSection(
  serverSection: ReportSectionReadModel | null | undefined,
  historyRef: RefObject<Map<string, ReportSectionReadModel>>,
  retainedRef: RefObject<RetainedEdits | null>,
) {
  useEffect(() => {
    if (serverSection) rememberSection(historyRef.current, serverSection);
    const retained = retainedRef.current;
    if (
      retained &&
      serverSection?.reportSectionId === retained.reportSectionId &&
      serverSection.version > retained.baseVersion
    )
      retainedRef.current = { ...retained, awaitingNewer: false };
  }, [serverSection, historyRef, retainedRef]);
}

// A conflicting save never replays the stale section, but the Lead's own item
// text and unfinished record edits stay over the authoritative section, held
// unsaved until the Lead edits or saves. Keep records before the newer revision
// arrives too: its payload may be unchanged and only refresh metadata.
export function useConflictRetainedEdits({
  acceptedVersion,
  serverSection,
  setDraftSection,
  payload,
}: {
  readonly acceptedVersion: number;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly setDraftSection: SetDraftSection;
  readonly payload: DraftSaveContent | null;
}) {
  const payloadKey = useMemo(
    () => (payload === null ? null : encodeDraftSaveComparisonKey(payload)),
    [payload],
  );
  const historyRef = useRef(new Map<string, ReportSectionReadModel>());
  const payloadRef = useRef(payload);
  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);
  const retainedRef = useRef<RetainedEdits | null>(null);
  const heldKeyRef = useRef<string | null>(null);
  const [heldKey, setHeldKey] = useState<string | null>(null);
  // A read and typing can share one commit. Capture that input before the
  // read releases the hold, so the following reseed still has the latest text.
  usePendingConflictInput({
    acceptedVersion,
    serverSection,
    payload,
    payloadKey,
    retainedRef,
    heldKeyRef,
    setHeldKey,
  });
  useObservedSection(serverSection, historyRef, retainedRef);

  const capture = useCallback((failed: AutosaveRequest) => {
    const { reportSectionId } = failed.payload;
    const base = historyRef.current.get(`${reportSectionId}:${failed.version}`);

    retainedRef.current = capturedEdits(
      failed,
      payloadRef.current,
      base,
      awaitingReadFor(retainedRef.current, reportSectionId),
    );
    return latestSection(historyRef.current, reportSectionId);
  }, []);

  const applyRetained = useCallback(
    (section: ReportSectionReadModel | null) => {
      const retained = retainedRef.current;
      if (!section || !retainedAppliesTo(retained, section)) return section;
      if (section.version > retained.baseVersion)
        retainedRef.current = { ...retained, awaitingNewer: false };
      const overlaid = overlayUnfinishedRecords(
        section.version > retained.baseVersion
          ? overlayItemTexts(section, retained.texts)
          : section,
        retained.records,
      );
      const key = encodeDraftSaveComparisonKey(sectionToDraftPayload(overlaid));
      heldKeyRef.current = key;
      setHeldKey(key);
      return overlaid;
    },
    [],
  );

  const setDraft = useCallback<SetDraftSection>(
    (next: SetStateAction<ReportSectionReadModel | null>) => {
      setDraftSection(typeof next === "function" ? next : applyRetained(next));
    },
    [applyRetained, setDraftSection],
  );

  const rememberSaved = useCallback((section: ReportSectionReadModel) => {
    rememberSection(historyRef.current, section);
    if (retainedRef.current?.reportSectionId === section.reportSectionId) {
      retainedRef.current = null;
      heldKeyRef.current = null;
      setHeldKey(null);
    }
  }, []);
  return { capture, rememberSaved, heldKey, setDraftSection: setDraft };
}
