import type { ReportSectionReadModel } from "@customreport/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  stableStringify,
  useLeadFormAutosave,
} from "../../../hooks/use-lead-form-autosave";
import { sectionToDraftPayload } from "../model/lead-section-draft-payload";

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

  // Optimistic-lock row revision of the loaded section. The hook is the single
  // source of truth: `version` drives autosave, while `versionRef` gives
  // submit/fillFrom a synchronous read that cannot go stale behind a render.
  const [version, setVersion] = useState(1);
  const versionRef = useRef(1);
  const setVersionSafe = useCallback((next: number) => {
    versionRef.current = next;
    setVersion(next);
  }, []);

  useEffect(() => {
    if (!serverSection) return;

    // Sync the optimistic-lock version on every load/refetch -- including when
    // content is unchanged. Version is not in the dirty key, so this never marks
    // the form dirty nor triggers a reseed on its own.
    setVersionSafe(serverSection.version);

    const serverDraftKey = stableStringify(
      sectionToDraftPayload(serverSection),
    );
    setIsSubmitted(serverSection.status === "submitted");

    if (lastServerDraftKeyRef.current === serverDraftKey) return;
    lastServerDraftKeyRef.current = serverDraftKey;
    setDraftSection(serverSection);
  }, [serverSection, setVersionSafe]);

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

  const autosave = useLeadFormAutosave({
    reportSectionId: sectionIdForActions || null,
    payload: draftPayload,
    enabled: !isReadOnlyEarly && draftSection !== null,
    initialSavedKey,
    version,
    onVersionChange: setVersionSafe,
    onConflict: handleConflict,
  });

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
