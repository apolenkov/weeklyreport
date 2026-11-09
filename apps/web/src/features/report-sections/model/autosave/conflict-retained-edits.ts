"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import {
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { AutosaveRequest, DraftSaveContent } from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  sectionRevision,
  type SetDraftSection,
} from "./use-server-section-reseed";

// Server sections kept to resolve the base revision of a conflicting save.
const SECTION_HISTORY_LIMIT = 8;

interface RetainedEdits {
  readonly reportSectionId: string;
  readonly baseVersion: number;
  readonly texts: ReadonlyMap<string, string>;
}

// Only the item texts the Lead changed relative to the revision the failed save
// was based on; anything else in the stale payload is not the Lead's edit.
function changedItemTexts(
  failed: AutosaveRequest,
  base: ReportSectionReadModel,
): Map<string, string> {
  const baseTexts = new Map(base.items.map((item) => [item.id, item.text]));
  const changed = new Map<string, string>();
  for (const item of failed.payload.items) {
    const baseText = item.id ? baseTexts.get(item.id) : undefined;
    if (item.id && baseText !== undefined && baseText !== item.text)
      changed.set(item.id, item.text);
  }
  return changed;
}

function overlayItemTexts(
  section: ReportSectionReadModel,
  texts: ReadonlyMap<string, string>,
): ReportSectionReadModel {
  const textOf = (id: string | undefined) =>
    id === undefined ? undefined : texts.get(id);
  if (!section.items.some((item) => textOf(item.id) !== undefined))
    return section;
  return {
    ...section,
    items: section.items.map((item) => {
      const text = textOf(item.id);
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
    section.version > retained.baseVersion
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

// A conflicting save never replays the stale section, but the Lead's own item
// text stays on screen: it is laid over the first newer authoritative section,
// held there unsaved (autosave reports an error) until the Lead edits or saves.
export function useConflictRetainedEdits({
  serverSection,
  setDraftSection,
  payload,
}: {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly setDraftSection: SetDraftSection;
  readonly payload: DraftSaveContent | null;
}) {
  const payloadKey = useMemo(
    () => (payload === null ? null : encodeDraftSaveComparisonKey(payload)),
    [payload],
  );
  const historyRef = useRef(new Map<string, ReportSectionReadModel>());
  const retainedRef = useRef<RetainedEdits | null>(null);
  const heldKeyRef = useRef<string | null>(null);
  const [heldKey, setHeldKey] = useState<string | null>(null);
  useEffect(() => {
    if (serverSection) rememberSection(historyRef.current, serverSection);
  }, [serverSection]);
  // Any change away from the held draft is the Lead's explicit reconciliation:
  // later server sections no longer receive the retained text. A stale heldKey
  // state is harmless because only an exactly equal draft is held.
  useEffect(() => {
    if (heldKeyRef.current === null || payloadKey === heldKeyRef.current)
      return;
    retainedRef.current = null;
    heldKeyRef.current = null;
  }, [payloadKey]);

  const capture = useCallback((failed: AutosaveRequest) => {
    const { reportSectionId } = failed.payload;
    const base = historyRef.current.get(`${reportSectionId}:${failed.version}`);
    const texts = base ? changedItemTexts(failed, base) : new Map();
    retainedRef.current =
      texts.size > 0
        ? { reportSectionId, baseVersion: failed.version, texts }
        : null;
  }, []);

  const applyRetained = useCallback(
    (section: ReportSectionReadModel | null) => {
      const retained = retainedRef.current;
      if (!section || !retainedAppliesTo(retained, section)) return section;
      const overlaid = overlayItemTexts(section, retained.texts);
      const key = encodeDraftSaveComparisonKey(sectionToDraftPayload(overlaid));
      heldKeyRef.current = key;
      setHeldKey(key);
      return overlaid;
    },
    [],
  );

  const setDraftWithRetained = useCallback<SetDraftSection>(
    (next: SetStateAction<ReportSectionReadModel | null>) => {
      setDraftSection(typeof next === "function" ? next : applyRetained(next));
    },
    [applyRetained, setDraftSection],
  );

  return { capture, heldKey, setDraftSection: setDraftWithRetained };
}
