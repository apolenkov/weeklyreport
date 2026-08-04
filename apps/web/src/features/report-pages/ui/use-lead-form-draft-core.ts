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
import { toast } from "sonner";

import { encodeAutosaveComparisonKey } from "../../../hooks/use-lead-form-autosave";
import { sectionToDraftPayload } from "../../report-sections";
import { applyDraftPatch, type DraftPatch } from "./lead-form-draft-patch";
import {
  type LeadFormGeneration,
  leadFormGenerationOf,
} from "./lead-form-generation";
import { useDraftServerSync } from "./use-lead-form-server-sync";

// Ref mirror of the optimistic-lock version so submit reads the current value
// without re-creating itself on every autosave bump.
function useDraftVersion() {
  const [version, setVersion] = useState(1);
  const versionRef = useRef(1);
  const setVersionSafe = useCallback((next: number) => {
    versionRef.current = next;
    setVersion(next);
  }, []);
  return { version, versionRef, setVersionSafe };
}

// The reload promise settles before the user is told it happened, so the
// announcement is never premature and a failed refetch is surfaced as such.
function useConflictReload(refetchSection: () => Promise<unknown>) {
  return useCallback(() => {
    void refetchSection()
      .then(() => {
        toast.error(
          "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
        );
      })
      .catch(() => {
        toast.error(
          "This section was changed elsewhere. Reload failed — refresh the page and re-apply your changes.",
        );
      });
  }, [refetchSection]);
}

function useDraftPayloadKeys(
  draftSection: ReportSectionReadModel | null,
  serverSection: ReportSectionReadModel | null | undefined,
) {
  const draftPayload = useMemo(
    () => (draftSection ? sectionToDraftPayload(draftSection) : null),
    [draftSection],
  );
  const initialSavedKey = useMemo(() => {
    if (!serverSection) return null;
    return encodeAutosaveComparisonKey(sectionToDraftPayload(serverSection));
  }, [serverSection]);
  return { draftPayload, initialSavedKey };
}

interface LeadFormDraftCoreArgs {
  readonly generation: LeadFormGeneration | null;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string | null;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
}

function useGenerationBoundApply(
  generation: LeadFormGeneration | null,
  setDraftSection: Dispatch<SetStateAction<ReportSectionReadModel | null>>,
) {
  return useCallback(
    (patch: DraftPatch) => {
      setDraftSection((current) =>
        current !== null &&
        generation !== null &&
        leadFormGenerationOf(current) === generation
          ? applyDraftPatch(current, patch)
          : current,
      );
    },
    [generation, setDraftSection],
  );
}

// The local draft engine: editable section state, its optimistic-lock version,
// and the autosave/reseed conversation with the server.
export function useLeadFormDraftCore({
  generation,
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
}: LeadFormDraftCoreArgs) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);
  const { version, versionRef, setVersionSafe } = useDraftVersion();
  const handleConflict = useConflictReload(refetchSection);
  const { draftPayload, initialSavedKey } = useDraftPayloadKeys(
    draftSection,
    serverSection,
  );
  const isReadOnlyEarly = isSubmitted || serverReadOnly;
  const autosave = useDraftServerSync({
    serverSection,
    reportSectionId: sectionIdForActions || null,
    payload: draftPayload,
    enabled: !isReadOnlyEarly && draftSection !== null,
    initialSavedKey,
    version,
    setVersionSafe,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
  const apply = useGenerationBoundApply(generation, setDraftSection);
  return {
    generation,
    draft: draftSection,
    draftPayload,
    dirty: autosave.dirty,
    autosave,
    version,
    versionRef,
    isSubmitted,
    setIsSubmitted,
    setVersionSafe,
    save: autosave.forceSave,
    handleConflict,
    apply,
  };
}
