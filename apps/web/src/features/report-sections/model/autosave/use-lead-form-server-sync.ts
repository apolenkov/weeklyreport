"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import type { LeadFormWritePort } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { DraftSaveContent } from "./autosave-types";
import {
  classifyReseed,
  type PendingSaveEcho,
  reconcileSavedIdentities,
} from "./lead-form-draft-reconcile";
import { useLeadFormAutosave } from "./use-lead-form-autosave";

type SetDraftSection = Dispatch<SetStateAction<ReportSectionReadModel | null>>;

// The echoes of our own writes, plus the last server key we re-based on.
// Mutation stays inside the owning hook so no caller writes through a ref.
interface SaveEchoLedger {
  readonly lastKey: () => string | null;
  readonly find: (serverDraftKey: string) => PendingSaveEcho | undefined;
  readonly record: (echo: PendingSaveEcho) => void;
  readonly consume: (serverDraftKey: string) => void;
}

function withoutEcho(
  echoes: readonly PendingSaveEcho[],
  serverDraftKey: string,
): PendingSaveEcho[] {
  return echoes.filter((pending) => pending.serverDraftKey !== serverDraftKey);
}

function useSaveEchoLedger(): SaveEchoLedger {
  const echoesRef = useRef<readonly PendingSaveEcho[]>([]);
  const lastKeyRef = useRef<string | null>(null);
  return useMemo(
    () => ({
      lastKey: () => lastKeyRef.current,
      find: (serverDraftKey) =>
        echoesRef.current.find(
          (pending) => pending.serverDraftKey === serverDraftKey,
        ),
      record: (echo) => {
        echoesRef.current = [
          ...withoutEcho(echoesRef.current, echo.serverDraftKey),
          echo,
        ];
      },
      consume: (serverDraftKey) => {
        lastKeyRef.current = serverDraftKey;
        echoesRef.current = withoutEcho(echoesRef.current, serverDraftKey);
      },
    }),
    [],
  );
}

function reconcileOnSave(
  savedSection: ReportSectionReadModel,
  persistedPayload: DraftSaveContent,
) {
  return (current: ReportSectionReadModel | null) =>
    current?.reportSectionId === savedSection.reportSectionId
      ? reconcileSavedIdentities(current, savedSection, persistedPayload)
      : current;
}

function reconcileWithEcho(echo: PendingSaveEcho) {
  return (current: ReportSectionReadModel | null) =>
    current
      ? reconcileSavedIdentities(
          current,
          echo.savedSection,
          echo.persistedPayload,
        )
      : current;
}

function useSaveEchoRecorder(
  ledger: SaveEchoLedger,
  setDraftSection: SetDraftSection,
) {
  return useCallback(
    (
      savedSection: ReportSectionReadModel,
      persistedPayload: DraftSaveContent,
    ) => {
      const serverDraftKey = encodeAutosaveComparisonKey(
        sectionToDraftPayload(savedSection),
      );
      ledger.record({ persistedPayload, savedSection, serverDraftKey });
      setDraftSection(reconcileOnSave(savedSection, persistedPayload));
    },
    [ledger, setDraftSection],
  );
}

interface ServerSectionReseedArgs {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly dirty: boolean;
  readonly ledger: SaveEchoLedger;
  readonly setVersionSafe: (next: number) => void;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
  readonly setDraftSection: SetDraftSection;
  readonly handleConflict: () => void;
}

// Server-section arrival re-bases the local draft engine (version, submitted
// flag, baseline) — an external-data sync, hence the state writes in an effect.
function useServerSectionReseed({
  serverSection,
  dirty,
  ledger,
  setVersionSafe,
  setIsSubmitted,
  setDraftSection,
  handleConflict,
}: ServerSectionReseedArgs) {
  useEffect(() => {
    if (!serverSection) return;
    setVersionSafe(serverSection.version);
    setIsSubmitted(serverSection.status === "submitted");

    const serverDraftKey = encodeAutosaveComparisonKey(
      sectionToDraftPayload(serverSection),
    );
    const saveEcho = ledger.find(serverDraftKey);
    const trigger = classifyReseed(
      serverDraftKey,
      ledger.lastKey(),
      dirty,
      saveEcho !== undefined,
    );
    if (trigger === "unchanged") return;

    ledger.consume(serverDraftKey);
    if (trigger === "save-echo" && dirty && saveEcho) {
      setDraftSection(reconcileWithEcho(saveEcho));
      return;
    }
    if (trigger === "external-dirty") handleConflict();
    setDraftSection(serverSection);
  }, [
    dirty,
    handleConflict,
    ledger,
    serverSection,
    setDraftSection,
    setIsSubmitted,
    setVersionSafe,
  ]);
}

interface DraftServerSyncArgs {
  readonly writePort: LeadFormWritePort;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly reportSectionId: string | null;
  readonly payload: DraftSaveContent | null;
  readonly enabled: boolean;
  readonly initialSavedKey: string | null;
  readonly version: number;
  readonly setVersionSafe: (next: number) => void;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
  readonly setDraftSection: SetDraftSection;
  readonly handleConflict: () => void;
}

// Both directions of the server conversation: autosave writes out, and the
// reseed effect re-bases the draft when a new server section arrives.
export function useDraftServerSync({
  writePort,
  serverSection,
  reportSectionId,
  payload,
  enabled,
  initialSavedKey,
  version,
  setVersionSafe,
  setIsSubmitted,
  setDraftSection,
  handleConflict,
}: DraftServerSyncArgs) {
  const ledger = useSaveEchoLedger();
  const onSaved = useSaveEchoRecorder(ledger, setDraftSection);
  const autosave = useLeadFormAutosave({
    writePort,
    reportSectionId,
    payload,
    enabled,
    initialSavedKey,
    version,
    onVersionChange: setVersionSafe,
    onSaved,
    onConflict: handleConflict,
  });
  useServerSectionReseed({
    serverSection,
    dirty: autosave.dirty,
    ledger,
    setVersionSafe,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
  return autosave;
}
