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
import { toast } from "sonner";

import { useDraftServerSync } from "../autosave/use-lead-form-server-sync";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { buildLeadSubmitPayload } from "../lead-submit-readiness";
import {
  applyDraftPatch,
  type DraftPatch,
} from "./draft/lead-form-draft-patch";
import {
  type LeadFormGeneration,
  leadFormGenerationOf,
} from "./lead-form-generation";
import type { SubmitOutcome } from "./lead-form-submit-context";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { isLeadFormWriteConflict } from "./lead-form-write-port";
import {
  type LeadFormOutcomeActions,
  useLeadFormOutcomeCoordinator,
} from "./use-lead-form-outcome-coordinator";

// Ref mirror of the optimistic-lock version so submit reads the current value
// without re-creating itself on every autosave bump.
function useDraftVersion(sectionId: string | null) {
  const [version, setVersion] = useState(1);
  const versionRef = useRef(1);
  const acceptedRef = useRef<{ sectionId: string | null; version: number }>({
    sectionId: null,
    version: 1,
  });
  const acceptVersion = useCallback(
    (candidateSectionId: string, next: number) => {
      const accepted = acceptedRef.current;
      if (
        accepted.sectionId === candidateSectionId &&
        next < accepted.version
      ) {
        return false;
      }
      acceptedRef.current = { sectionId: candidateSectionId, version: next };
      versionRef.current = next;
      setVersion(next);
      return true;
    },
    [],
  );
  const setVersionSafe = useCallback(
    (next: number) => {
      if (sectionId !== null) acceptVersion(sectionId, next);
    },
    [acceptVersion, sectionId],
  );
  return { version, versionRef, setVersionSafe, acceptVersion };
}

// Capture the committed activation, so returning to the same section is distinct.
function useGenerationCapture(generation: LeadFormGeneration | null) {
  const scope = useMemo(() => ({ generation }), [generation]);
  const liveScope = useRef<{ generation: LeadFormGeneration | null } | null>(
    null,
  );
  useEffect(() => {
    liveScope.current = scope;
    return () => {
      liveScope.current = null;
    };
  }, [scope]);
  return useCallback(() => {
    return liveScope.current === scope
      ? () => liveScope.current === scope
      : null;
  }, [scope]);
}

// Announce only after the refetch settles while the originating section is active.
function useConflictReload(
  refetchSection: () => Promise<unknown>,
  captureGeneration: ReturnType<typeof useGenerationCapture>,
) {
  return useCallback(() => {
    const isCurrent = captureGeneration();
    if (!isCurrent) return;
    void refetchSection()
      .then(() => {
        if (!isCurrent()) return;
        toast.error(
          "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
        );
      })
      .catch(() => {
        if (!isCurrent()) return;
        toast.error(
          "This section was changed elsewhere. Reload failed — refresh the page and re-apply your changes.",
        );
      });
  }, [captureGeneration, refetchSection]);
}

function useDraftPayload(draftSection: ReportSectionReadModel | null) {
  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );
  return draftPayload;
}

function submitErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Submit failed";
}

interface LeadFormDraftCoreArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string | null;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
}

function useGenerationBoundApply(
  generation: LeadFormGeneration | null,
  setDraftSection: Dispatch<SetStateAction<ReportSectionReadModel | null>>,
  isOutcomeLocked: () => boolean,
) {
  return useCallback(
    (patch: DraftPatch) => {
      if (isOutcomeLocked()) return;
      setDraftSection((current) =>
        current !== null &&
        generation !== null &&
        leadFormGenerationOf(current) === generation
          ? applyDraftPatch(current, patch)
          : current,
      );
    },
    [generation, isOutcomeLocked, setDraftSection],
  );
}

// The local draft engine: editable section state, its optimistic-lock version,
// and the autosave/reseed conversation with the server.
export function useLeadFormDraftCore({
  writePort,
  generation,
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
}: LeadFormDraftCoreArgs) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);
  const { version, versionRef, setVersionSafe, acceptVersion } =
    useDraftVersion(sectionIdForActions);
  const captureGeneration = useGenerationCapture(generation);
  const handleConflict = useConflictReload(refetchSection, captureGeneration);
  const draftPayload = useDraftPayload(draftSection);
  const isReadOnlyEarly = isSubmitted || serverReadOnly;
  const serverSync = useDraftServerSync({
    writePort,
    serverSection,
    reportSectionId: sectionIdForActions || null,
    payload: draftPayload,
    enabled: !isReadOnlyEarly && draftSection !== null,
    version,
    setVersionSafe,
    acceptVersion,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
  const outcomeCoordinator = useLeadFormOutcomeCoordinator({
    writePort,
    generation,
    sectionId: sectionIdForActions,
    draftSection,
    version,
    autosave: serverSync.autosave,
    readOnly: serverReadOnly,
    submitted: isSubmitted,
    acceptVersion,
    adoptServerSection: serverSync.adoptServerSection,
  });
  const apply = useGenerationBoundApply(
    generation,
    setDraftSection,
    outcomeCoordinator.isLocked,
  );
  const outcomes = useMemo<LeadFormOutcomeActions>(
    () => ({
      pending: outcomeCoordinator.pending,
      canExecute: outcomeCoordinator.canExecute,
      blockedReason: outcomeCoordinator.blockedReason,
      resolve: outcomeCoordinator.resolve,
      restore: outcomeCoordinator.restore,
    }),
    [outcomeCoordinator],
  );
  const markUnsubmitted = useCallback(() => setIsSubmitted(false), []);
  const draftGeneration =
    draftSection === null ? null : leadFormGenerationOf(draftSection);
  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    if (outcomeCoordinator.isLocked()) return "not-ready";
    if (!draftPayload) return "no-draft";
    const isCurrent = captureGeneration();
    if (
      !isCurrent ||
      draftGeneration !== generation ||
      draftPayload.reportSectionId !== sectionIdForActions
    )
      return "not-ready";
    try {
      const saved = await writePort.submit(
        buildLeadSubmitPayload(draftPayload, versionRef.current),
      );
      if (
        !isCurrent() ||
        saved.reportSectionId !== draftPayload.reportSectionId ||
        !acceptVersion(saved.reportSectionId, saved.version)
      )
        return "not-ready";
      setIsSubmitted(true);
      return "submitted";
    } catch (error: unknown) {
      if (!isCurrent()) return "not-ready";
      if (isLeadFormWriteConflict(error)) {
        handleConflict();
        return "conflict";
      }
      toast.error(submitErrorMessage(error));
      return "error";
    }
  }, [
    acceptVersion,
    captureGeneration,
    draftPayload,
    draftGeneration,
    generation,
    handleConflict,
    outcomeCoordinator,
    sectionIdForActions,
    versionRef,
    writePort,
  ]);
  return {
    generation,
    draft: draftSection,
    draftPayload,
    dirty: serverSync.autosave.dirty,
    autosave: serverSync.autosave,
    lastSaveReceipt: serverSync.lastSaveReceipt,
    outcomes,
    version,
    isSubmitted,
    markUnsubmitted,
    setVersionSafe,
    save: serverSync.autosave.forceSave,
    submit,
    reloadAfterConflict: handleConflict,
    adoptServerSection: serverSync.adoptServerSection,
    apply,
  };
}
