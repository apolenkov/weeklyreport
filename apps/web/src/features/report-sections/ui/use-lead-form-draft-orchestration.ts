import type { ReportSectionReadModel } from "@customreport/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type DraftSaveContent,
  stableStringify,
  useLeadFormAutosave,
} from "../../../hooks/use-lead-form-autosave";
import { sectionToDraftPayload } from "../model/lead-section-draft-payload";

type DraftRecord = Readonly<{ id?: string; stableId?: string }>;
type ReseedTrigger =
  | "unchanged"
  | "save-echo"
  | "external-clean"
  | "external-dirty";

interface PendingSaveEcho {
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
function reconcileSavedIdentities(
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
function classifyReseed(
  serverDraftKey: string,
  lastServerDraftKey: string | null,
  dirty: boolean,
  isSaveEcho: boolean,
): ReseedTrigger {
  if (serverDraftKey === lastServerDraftKey) return "unchanged";
  if (isSaveEcho) return "save-echo";
  return dirty ? "external-dirty" : "external-clean";
}

interface UseLeadFormDraftOrchestrationArgs {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
}

export function useLeadFormDraftOrchestration({
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
}: UseLeadFormDraftOrchestrationArgs) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);
  const lastServerDraftKeyRef = useRef<string | null>(null);
  const pendingSaveEchoesRef = useRef<readonly PendingSaveEcho[]>([]);

  // Optimistic-lock row revision of the loaded section. The hook is the single
  // source of truth: `version` drives autosave, while `versionRef` gives
  // submit/fillFrom a synchronous read that cannot go stale behind a render.
  const [version, setVersion] = useState(1);
  const versionRef = useRef(1);
  const setVersionSafe = useCallback((next: number) => {
    versionRef.current = next;
    setVersion(next);
  }, []);

  const handleConflict = useCallback(() => {
    void refetchSection();
    toast.error(
      "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
    );
  }, [refetchSection]);

  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );

  const isReadOnlyEarly = isSubmitted || serverReadOnly;

  const initialSavedKey = useMemo(() => {
    if (!serverSection) return null;
    return stableStringify(sectionToDraftPayload(serverSection));
  }, [serverSection]);

  const handleSaved = useCallback(
    (
      savedSection: ReportSectionReadModel,
      persistedPayload: DraftSaveContent,
    ) => {
      const serverDraftKey = stableStringify(
        sectionToDraftPayload(savedSection),
      );
      pendingSaveEchoesRef.current = [
        ...pendingSaveEchoesRef.current.filter(
          (pending) => pending.serverDraftKey !== serverDraftKey,
        ),
        { persistedPayload, savedSection, serverDraftKey },
      ];
      setDraftSection((current) =>
        current?.reportSectionId === savedSection.reportSectionId
          ? reconcileSavedIdentities(current, savedSection, persistedPayload)
          : current,
      );
    },
    [],
  );

  const autosave = useLeadFormAutosave({
    reportSectionId: sectionIdForActions || null,
    payload: draftPayload,
    enabled: !isReadOnlyEarly && draftSection !== null,
    initialSavedKey,
    version,
    onVersionChange: setVersionSafe,
    onSaved: handleSaved,
    onConflict: handleConflict,
  });

  useEffect(() => {
    if (!serverSection) return;
    setVersionSafe(serverSection.version);
    setIsSubmitted(serverSection.status === "submitted");

    const serverDraftKey = stableStringify(
      sectionToDraftPayload(serverSection),
    );
    const saveEcho = pendingSaveEchoesRef.current.find(
      (pending) => pending.serverDraftKey === serverDraftKey,
    );
    const trigger = classifyReseed(
      serverDraftKey,
      lastServerDraftKeyRef.current,
      autosave.dirty,
      saveEcho !== undefined,
    );
    if (trigger === "unchanged") return;

    lastServerDraftKeyRef.current = serverDraftKey;
    pendingSaveEchoesRef.current = pendingSaveEchoesRef.current.filter(
      (pending) => pending.serverDraftKey !== serverDraftKey,
    );
    if (trigger === "save-echo" && autosave.dirty && saveEcho) {
      setDraftSection((current) =>
        current
          ? reconcileSavedIdentities(
              current,
              saveEcho.savedSection,
              saveEcho.persistedPayload,
            )
          : current,
      );
      return;
    }
    if (trigger === "external-dirty") handleConflict();
    setDraftSection(serverSection);
  }, [autosave.dirty, handleConflict, serverSection, setVersionSafe]);

  return {
    autosave,
    draftPayload,
    draftSection,
    handleConflict,
    isSubmitted,
    setDraftSection,
    setIsSubmitted,
    setVersionSafe,
    versionRef,
  };
}
