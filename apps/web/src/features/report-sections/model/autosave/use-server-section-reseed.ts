"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { type Dispatch, type SetStateAction, useEffect } from "react";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { AutosaveController } from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  classifyReseed,
  type PendingSaveEcho,
  reconcileSavedIdentities,
  reconcileServerRecordMetadata,
} from "./lead-form-draft-reconcile";

export type SetDraftSection = Dispatch<
  SetStateAction<ReportSectionReadModel | null>
>;

// The echoes of our own writes, plus the last server key we re-based on.
// Mutation stays inside the owning hook so no caller writes through a ref.
export interface SaveEchoLedger {
  readonly lastKey: () => string | null;
  readonly lastRevision: () => string | null;
  readonly find: (serverDraftKey: string) => PendingSaveEcho | undefined;
  readonly record: (echo: PendingSaveEcho) => void;
  readonly consume: (serverDraftKey: string, revision: string) => void;
}

export function sectionRevision(section: ReportSectionReadModel): string {
  return `${section.reportSectionId}:${section.version}`;
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

interface ServerSectionReseedArgs {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  // "Local edits exist": the payload difference OR a partially typed row the
  // payload cannot carry. A server reseed must report those instead of
  // replacing the draft without a word.
  readonly hasLocalEdits: boolean;
  readonly ledger: SaveEchoLedger;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly autosave: AutosaveController;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
  readonly setDraftSection: SetDraftSection;
  readonly handleConflict: () => void;
}

// Server-section arrival re-bases the local draft engine (version, submitted
// flag, baseline) — an external-data sync, hence the state writes in an effect.
export function useServerSectionReseed({
  serverSection,
  hasLocalEdits,
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
      hasLocalEdits && sameSection,
      saveEcho !== undefined,
    );
    if (trigger === "unchanged") {
      if (ledger.lastRevision() !== revision) {
        ledger.consume(serverDraftKey, revision);
      }
      // Reviewer feedback lands without moving the section version, so the merge
      // runs on every delivery. It returns the current object unchanged when
      // nothing differs, which keeps this idempotent instead of re-rendering.
      setDraftSection((current) =>
        reconcileServerRecordMetadata(current, serverSection),
      );
      return;
    }

    ledger.consume(serverDraftKey, revision);
    if (trigger === "save-echo" && hasLocalEdits && saveEcho) {
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
    hasLocalEdits,
    handleConflict,
    ledger,
    serverSection,
    setDraftSection,
    setIsSubmitted,
  ]);
}
