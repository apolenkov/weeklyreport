"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { mutationErrorMessage } from "../../../../shared/lib/errors/mutation-error-message";
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
export function useDraftVersion(sectionId: string | null) {
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
export function useGenerationCapture(generation: LeadFormGeneration | null) {
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
export function useConflictReload(
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

export function useDraftPayload(draftSection: ReportSectionReadModel | null) {
  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );
  return draftPayload;
}

// A bare browser transport message ("Failed to fetch") is not actionable.
const SUBMIT_FAILURE_MESSAGE =
  "Submit failed. Check your connection and try again.";

function submitErrorMessage(error: unknown): string {
  return (
    mutationErrorMessage(error, SUBMIT_FAILURE_MESSAGE) ||
    SUBMIT_FAILURE_MESSAGE
  );
}

export function useGenerationBoundApply(
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

interface DraftSubmitArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly draftPayload: ReturnType<typeof useDraftPayload>;
  readonly draftGeneration: LeadFormGeneration | null;
  readonly versionRef: RefObject<number>;
  readonly isOutcomeLocked: () => boolean;
  readonly captureGeneration: ReturnType<typeof useGenerationCapture>;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly handleConflict: () => void;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
}

export function useDraftSubmit({
  writePort,
  generation,
  sectionIdForActions,
  draftPayload,
  draftGeneration,
  versionRef,
  isOutcomeLocked,
  captureGeneration,
  acceptVersion,
  handleConflict,
  setIsSubmitted,
}: DraftSubmitArgs) {
  return useCallback(async (): Promise<SubmitOutcome> => {
    if (isOutcomeLocked()) return "not-ready";
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
    isOutcomeLocked,
    setIsSubmitted,
    sectionIdForActions,
    versionRef,
    writePort,
  ]);
}

export function useOutcomeActions(
  coordinator: ReturnType<typeof useLeadFormOutcomeCoordinator>,
) {
  return useMemo<LeadFormOutcomeActions>(
    () => ({
      pending: coordinator.pending,
      canExecute: coordinator.canExecute,
      blockedReason: coordinator.blockedReason,
      resolve: coordinator.resolve,
      restore: coordinator.restore,
      promote: coordinator.promote,
    }),
    [coordinator],
  );
}
