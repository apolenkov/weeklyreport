"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { leadFormGenerationOf } from "../lead-form/lead-form-generation";
import type { LeadFormWritePort } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { AutosaveSaveReceipt, DraftSaveContent } from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  type PendingSaveEcho,
  reconcileSavedIdentities,
  reconcileSavedPayloadIdentities,
  savedRecordIdentityPairs,
} from "./lead-form-draft-reconcile";
import { useLeadFormAutosave } from "./use-lead-form-autosave";
import {
  type SaveEchoLedger,
  sectionRevision,
  type SetDraftSection,
  useServerSectionReseed,
} from "./use-server-section-reseed";

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

function reconcileOnSave(
  savedSection: ReportSectionReadModel,
  persistedPayload: DraftSaveContent,
) {
  return (current: ReportSectionReadModel | null) =>
    current?.reportSectionId === savedSection.reportSectionId
      ? reconcileSavedIdentities(current, savedSection, persistedPayload)
      : current;
}

function useSaveEchoRecorder(
  ledger: SaveEchoLedger,
  setDraftSection: SetDraftSection,
  setLastSaveReceipt: Dispatch<SetStateAction<AutosaveSaveReceipt | null>>,
  receiptScope: string,
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
        scope: receiptScope,
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
    [ledger, receiptScope, setDraftSection, setLastSaveReceipt],
  );
}

interface DraftServerSyncArgs {
  readonly receiptScope: string;
  readonly writePort: LeadFormWritePort;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly reportSectionId: string | null;
  readonly payload: DraftSaveContent | null;
  readonly enabled: boolean;
  readonly version: number;
  readonly localOnlyRows: number;
  readonly setVersionSafe: (next: number) => void;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
  readonly setDraftSection: SetDraftSection;
  readonly handleConflict: () => void;
}

// Both directions of the server conversation: autosave writes out, and the
// reseed effect re-bases the draft when a new server section arrives.
export function useDraftServerSync({
  receiptScope,
  writePort,
  serverSection,
  reportSectionId,
  payload,
  enabled,
  version,
  localOnlyRows,
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
    receiptScope,
  );
  const autosave = useLeadFormAutosave({
    writePort,
    reportSectionId,
    payload,
    enabled,
    localOnlyRows,
    version,
    onVersionChange: setVersionSafe,
    onSaved,
    onConflict: handleConflict,
  });
  useServerSectionReseed({
    serverSection,
    hasLocalEdits: autosave.dirty || localOnlyRows > 0,
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

  return useMemo(
    () => ({
      autosave,
      lastSaveReceipt,
      receiptScope,
      adoptServerSection,
    }),
    [adoptServerSection, autosave, lastSaveReceipt, receiptScope],
  );
}
