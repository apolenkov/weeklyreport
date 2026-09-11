"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { leadFormGenerationOf } from "../lead-form/lead-form-generation";
import type { LeadFormWritePort } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type {
  AutosaveController,
  AutosaveSaveReceipt,
  AutosaveSnapshot,
  DraftSaveContent,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  classifyReseed,
  type PendingSaveEcho,
  reconcileSavedIdentities,
  reconcileSavedPayloadIdentities,
  reconcileServerOutcomeMetadata,
  savedRecordIdentityPairs,
} from "./lead-form-draft-reconcile";
import { useLeadFormAutosave } from "./use-lead-form-autosave";

type SetDraftSection = Dispatch<SetStateAction<ReportSectionReadModel | null>>;

// The echoes of our own writes, plus the last server key we re-based on.
// Mutation stays inside the owning hook so no caller writes through a ref.
interface SaveEchoLedger {
  readonly lastKey: () => string | null;
  readonly lastRevision: () => string | null;
  readonly find: (serverDraftKey: string) => PendingSaveEcho | undefined;
  readonly record: (echo: PendingSaveEcho) => void;
  readonly consume: (serverDraftKey: string, revision: string) => void;
}

function sectionRevision(section: ReportSectionReadModel): string {
  return `${section.reportSectionId}:${section.version}`;
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
  const lastRevisionRef = useRef<string | null>(null);
  return useMemo(
    () => ({
      lastKey: () => lastKeyRef.current,
      lastRevision: () => lastRevisionRef.current,
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
      consume: (serverDraftKey, revision) => {
        lastKeyRef.current = serverDraftKey;
        lastRevisionRef.current = revision;
        echoesRef.current = withoutEcho(echoesRef.current, serverDraftKey);
      },
    }),
    [],
  );
}

function findExactSaveEcho(
  ledger: SaveEchoLedger,
  serverDraftKey: string,
  revision: string,
  sameSection: boolean,
): PendingSaveEcho | undefined {
  const candidate = ledger.find(serverDraftKey);
  return sameSection &&
    candidate &&
    sectionRevision(candidate.savedSection) === revision
    ? candidate
    : undefined;
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
  setLastSaveReceipt: Dispatch<SetStateAction<AutosaveSaveReceipt | null>>,
) {
  return useCallback(
    (
      savedSection: ReportSectionReadModel,
      persistedPayload: DraftSaveContent,
      queuedPayload: DraftSaveContent | null,
    ) => {
      const savedPayload = sectionToDraftPayload(savedSection);
      const serverDraftKey = encodeDraftSaveComparisonKey(savedPayload);
      ledger.record({ persistedPayload, savedSection, serverDraftKey });
      setLastSaveReceipt((current) => ({
        sequence: (current?.sequence ?? 0) + 1,
        generation: leadFormGenerationOf(savedSection),
        reportSectionId: savedSection.reportSectionId,
        version: savedSection.version,
        itemIdentities: savedRecordIdentityPairs(
          persistedPayload.items,
          savedPayload.items,
        ),
      }));
      setDraftSection(reconcileOnSave(savedSection, persistedPayload));
      return {
        savedKey: serverDraftKey,
        queuedPayload:
          queuedPayload === null
            ? null
            : reconcileSavedPayloadIdentities(
                queuedPayload,
                savedPayload,
                persistedPayload,
              ),
      };
    },
    [ledger, setDraftSection, setLastSaveReceipt],
  );
}

interface ServerSectionReseedArgs {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly dirty: boolean;
  readonly ledger: SaveEchoLedger;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly autosave: AutosaveController;
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
  acceptVersion,
  autosave,
  setIsSubmitted,
  setDraftSection,
  handleConflict,
}: ServerSectionReseedArgs) {
  useEffect(() => {
    if (!serverSection) return;
    if (!acceptVersion(serverSection.reportSectionId, serverSection.version)) {
      return;
    }
    setIsSubmitted(serverSection.status === "submitted");

    const serverDraftKey = encodeDraftSaveComparisonKey(
      sectionToDraftPayload(serverSection),
    );
    const revision = sectionRevision(serverSection);
    const sameSection =
      ledger.lastRevision()?.startsWith(`${serverSection.reportSectionId}:`) ??
      false;
    const saveEcho = findExactSaveEcho(
      ledger,
      serverDraftKey,
      revision,
      sameSection,
    );
    const trigger = classifyReseed(
      serverDraftKey,
      sameSection ? ledger.lastKey() : null,
      dirty && sameSection,
      saveEcho !== undefined,
    );
    if (trigger === "unchanged") {
      if (ledger.lastRevision() !== revision) {
        ledger.consume(serverDraftKey, revision);
        setDraftSection((current) =>
          reconcileServerOutcomeMetadata(current, serverSection),
        );
      }
      return;
    }

    ledger.consume(serverDraftKey, revision);
    if (trigger === "save-echo" && dirty && saveEcho) {
      autosave.primeBaseline(serverDraftKey);
      setDraftSection(reconcileWithEcho(saveEcho));
      return;
    }
    if (trigger === "external-dirty") handleConflict();
    autosave.adoptBaseline(serverDraftKey, "read");
    setDraftSection(serverSection);
  }, [
    acceptVersion,
    autosave,
    dirty,
    handleConflict,
    ledger,
    serverSection,
    setDraftSection,
    setIsSubmitted,
  ]);
}

interface DraftServerSyncArgs {
  readonly writePort: LeadFormWritePort;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly reportSectionId: string | null;
  readonly payload: DraftSaveContent | null;
  readonly enabled: boolean;
  readonly version: number;
  readonly setVersionSafe: (next: number) => void;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
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
  version,
  setVersionSafe,
  acceptVersion,
  setIsSubmitted,
  setDraftSection,
  handleConflict,
}: DraftServerSyncArgs) {
  const ledger = useSaveEchoLedger();
  const [lastSaveReceipt, setLastSaveReceipt] =
    useState<AutosaveSaveReceipt | null>(null);
  const onSaved = useSaveEchoRecorder(
    ledger,
    setDraftSection,
    setLastSaveReceipt,
  );
  const autosave = useLeadFormAutosave({
    writePort,
    reportSectionId,
    payload,
    enabled,
    version,
    onVersionChange: setVersionSafe,
    onSaved,
    onConflict: handleConflict,
  });
  useServerSectionReseed({
    serverSection,
    dirty: autosave.dirty,
    ledger,
    acceptVersion,
    autosave,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
  const adoptServerSection = useCallback(
    (section: ReportSectionReadModel) => {
      const savedKey = encodeDraftSaveComparisonKey(
        sectionToDraftPayload(section),
      );
      ledger.consume(savedKey, sectionRevision(section));
      autosave.adoptBaseline(savedKey, "write");
      setIsSubmitted(section.status === "submitted");
      setDraftSection(section);
    },
    [autosave, ledger, setDraftSection, setIsSubmitted],
  );

  return useMemo<{
    readonly autosave: AutosaveSnapshot;
    readonly lastSaveReceipt: AutosaveSaveReceipt | null;
    readonly adoptServerSection: (section: ReportSectionReadModel) => void;
  }>(
    () => ({
      autosave,
      lastSaveReceipt,
      adoptServerSection,
    }),
    [adoptServerSection, autosave, lastSaveReceipt],
  );
}
