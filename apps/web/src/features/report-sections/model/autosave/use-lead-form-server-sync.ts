"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import type { DraftStageMemory } from "../draft-stage-memory";
import {
  type LeadFormGeneration,
  leadFormGenerationOf,
} from "../lead-form/lead-form-generation";
import type { LeadFormWritePort } from "../lead-form/lead-form-write-port";
import { useLeadFormStageMemory } from "../lead-form/use-draft-stage-memory";
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

interface SaveEchoRecorderArgs {
  readonly ledger: SaveEchoLedger;
  readonly setDraftSection: SetDraftSection;
  readonly setLastSaveReceipt: Dispatch<
    SetStateAction<AutosaveSaveReceipt | null>
  >;
  readonly receiptScope: string;
  readonly stageMemory: DraftStageMemory;
}

function useSaveEchoRecorder(args: SaveEchoRecorderArgs) {
  const {
    ledger,
    setDraftSection,
    setLastSaveReceipt,
    receiptScope,
    stageMemory,
  } = args;
  return useCallback(
    (
      savedSection: ReportSectionReadModel,
      persistedPayload: DraftSaveContent,
      queuedPayload: DraftSaveContent | null,
      attemptToken?: string,
    ) => {
      const savedPayload = sectionToDraftPayload(savedSection);
      // The save's row mapping is what ties a pending stage choice to its own
      // record; the accepted section is the authority on what it now carries.
      stageMemory.confirmPersisted(savedSection, [
        ...savedRecordIdentityPairs(persistedPayload.items, savedPayload.items),
        ...savedRecordIdentityPairs(persistedPayload.risks, savedPayload.risks),
        ...savedRecordIdentityPairs(
          persistedPayload.decisions,
          savedPayload.decisions,
        ),
      ]);
      const serverDraftKey = encodeDraftSaveComparisonKey(savedPayload);
      ledger.record({ persistedPayload, savedSection, serverDraftKey });
      setLastSaveReceipt((current) => ({
        sequence: (current?.sequence ?? 0) + 1,
        scope: receiptScope,
        generation: leadFormGenerationOf(savedSection),
        reportSectionId: savedSection.reportSectionId,
        version: savedSection.version,
        attemptToken,
        persistedItems: Object.freeze(
          savedSection.items.map((item) =>
            Object.freeze({
              ...item,
              stageNames: Object.freeze([...item.stageNames]),
            }),
          ),
        ),
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
    [ledger, receiptScope, setDraftSection, setLastSaveReceipt, stageMemory],
  );
}

interface DraftServerSyncArgs {
  readonly generation: LeadFormGeneration | null;
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
  generation,
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
  // The open draft owns one stage memory; it is reset with the generation.
  const stageMemory = useLeadFormStageMemory(generation);
  const ledger = useSaveEchoLedger();
  const [lastSaveReceipt, setLastSaveReceipt] =
    useState<AutosaveSaveReceipt | null>(null);
  const onSaved = useSaveEchoRecorder({
    ledger,
    setDraftSection,
    setLastSaveReceipt,
    receiptScope,
    stageMemory,
  });
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
    hasLocalEdits:
      (payload !== null && !autosave.currentPayloadMatchesSavedBaseline) ||
      localOnlyRows > 0,
    ledger,
    acceptVersion,
    autosave,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
  // A failed persistence leaves the previous default in place: the local choice
  // was only ever pending and `recall` never reads a pending choice.
  const adoptServerSection = useCallback(
    (section: ReportSectionReadModel) => {
      // An adopted section carries no draft-save row mapping, so only records
      // whose own id it already holds can confirm their pending choice.
      stageMemory.confirmPersisted(section);
      const savedKey = encodeDraftSaveComparisonKey(
        sectionToDraftPayload(section),
      );
      ledger.consume(savedKey, sectionRevision(section));
      autosave.adoptBaseline(savedKey, "write");
      setIsSubmitted(section.status === "submitted");
      setDraftSection(section);
    },
    [autosave, ledger, setDraftSection, setIsSubmitted, stageMemory],
  );

  return useMemo(
    () => ({
      autosave,
      lastSaveReceipt,
      receiptScope,
      stageMemory,
      adoptServerSection,
    }),
    [adoptServerSection, autosave, lastSaveReceipt, receiptScope, stageMemory],
  );
}
