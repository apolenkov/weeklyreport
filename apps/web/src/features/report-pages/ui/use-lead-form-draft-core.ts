"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { stableStringify } from "../../../hooks/use-lead-form-autosave";
import { sectionToDraftPayload } from "../../report-sections";
import { applyDraftPatch, type DraftPatch } from "./lead-form-draft-patch";
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

function useConflictReload(refetchSection: () => Promise<unknown>) {
  return useCallback(() => {
    void refetchSection();
    toast.error(
      "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
    );
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
    return stableStringify(sectionToDraftPayload(serverSection));
  }, [serverSection]);
  return { draftPayload, initialSavedKey };
}

interface LeadFormDraftCoreArgs {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
}

// The local draft engine: editable section state, its optimistic-lock version,
// and the autosave/reseed conversation with the server.
/**
 * Use Lead Form Draft Core.
 * @param props - The props argument.
 */
export function useLeadFormDraftCore({
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
  const apply = useCallback((patch: DraftPatch) => {
    setDraftSection((prev) => (prev ? applyDraftPatch(prev, patch) : prev));
  }, []);
  return {
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
