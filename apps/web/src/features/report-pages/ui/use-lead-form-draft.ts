"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type DraftSaveContent,
  stableStringify,
  useLeadFormAutosave,
} from "../../../hooks/use-lead-form-autosave";
import { isConflictError } from "../../../lib/trpc";
import {
  buildLeadSubmitPayload,
  type CrossAuthorRow,
  deriveLeadSubmitReadiness,
  mapLeadRisks,
  sectionToDraftPayload,
} from "../../report-sections";
import { applyDraftPatch, type DraftPatch } from "./lead-form-draft-patch";
import {
  classifyReseed,
  type PendingSaveEcho,
  reconcileSavedIdentities,
} from "./lead-form-draft-reconcile";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import {
  buildReadinessProducts,
  buildSubmitStages,
  type LeadFormLoadedContext,
  type SubmitOutcome,
} from "./lead-form-submit-context";
import { useLeadFormQuickAdd } from "./use-lead-form-quick-add";

export type { QuickAddItem } from "./use-lead-form-quick-add";

interface UseLeadFormDraftArgs {
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
  readonly loaded: LeadFormLoadedContext;
  readonly seam: LeadFormDraftSeam;
  /** Server-static cross-author status feed (readiness re-applies its overrides in the Everyone lens). */
  readonly crossAuthors: readonly CrossAuthorRow[];
  readonly isEveryone: boolean;
}

/**
 * The deep draft module: owns the editable section, autosave + save-echo
 * reconciliation, optimistic-lock version, submit readiness + submit, and every
 * draft merge behind one handle. The modal quick-add + blocker-prefill cluster
 * lives in `useLeadFormQuickAdd`; its results are spread onto this handle so the
 * public shape is unchanged. Live view-model inputs a callback needs enter as
 * the plain `loaded` render arg, forwarded to that hook — no ref crosses here.
 */
export function useLeadFormDraft({
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
  crossAuthors,
  isEveryone,
  loaded,
  seam,
}: UseLeadFormDraftArgs) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);
  const lastServerDraftKeyRef = useRef<string | null>(null);
  const pendingSaveEchoesRef = useRef<readonly PendingSaveEcho[]>([]);

  const [version, setVersion] = useState(1);
  const versionRef = useRef(1);
  const setVersionSafe = useCallback((next: number) => {
    versionRef.current = next;
    setVersion(next);
  }, []);

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

  const handleSaved = useCallback(
    (
      savedSection: ReportSectionReadModel,
      persistedPayload: DraftSaveContent,
    ) => {
      const serverDraftKey = stableStringify(
        sectionToDraftPayload(savedSection),
      );
      pendingSaveEchoesRef.current = [
        ...pendingSaveEchoesRef.current.filter(
          (pending) => pending.serverDraftKey !== serverDraftKey,
        ),
        { persistedPayload, savedSection, serverDraftKey },
      ];
      setDraftSection((current) =>
        current?.reportSectionId === savedSection.reportSectionId
          ? reconcileSavedIdentities(current, savedSection, persistedPayload)
          : current,
      );
    },
    [],
  );

  const autosave = useLeadFormAutosave({
    reportSectionId: sectionIdForActions || null,
    payload: draftPayload,
    enabled: !isReadOnlyEarly && draftSection !== null,
    initialSavedKey,
    version,
    onVersionChange: setVersionSafe,
    onSaved: handleSaved,
    onConflict: handleConflict,
  });

  useEffect(() => {
    if (!serverSection) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server-section arrival re-bases the local draft engine (version/submitted/baseline) — external-data sync
    setVersionSafe(serverSection.version);
    setIsSubmitted(serverSection.status === "submitted");

    const serverDraftKey = stableStringify(
      sectionToDraftPayload(serverSection),
    );
    const saveEcho = pendingSaveEchoesRef.current.find(
      (pending) => pending.serverDraftKey === serverDraftKey,
    );
    const trigger = classifyReseed(
      serverDraftKey,
      lastServerDraftKeyRef.current,
      autosave.dirty,
      saveEcho !== undefined,
    );
    if (trigger === "unchanged") return;

    lastServerDraftKeyRef.current = serverDraftKey;
    pendingSaveEchoesRef.current = pendingSaveEchoesRef.current.filter(
      (pending) => pending.serverDraftKey !== serverDraftKey,
    );
    if (trigger === "save-echo" && autosave.dirty && saveEcho) {
      setDraftSection((current) =>
        current
          ? reconcileSavedIdentities(
              current,
              saveEcho.savedSection,
              saveEcho.persistedPayload,
            )
          : current,
      );
      return;
    }
    if (trigger === "external-dirty") handleConflict();
    setDraftSection(serverSection);
  }, [autosave.dirty, handleConflict, serverSection, setVersionSafe]);

  const apply = useCallback((patch: DraftPatch) => {
    setDraftSection((prev) => (prev ? applyDraftPatch(prev, patch) : prev));
  }, []);

  // Modal quick-add + blocker-prefill cluster. Kept out of this core because it
  // touches neither the optimistic-lock version nor the dual-state write path.
  const quickAddCluster = useLeadFormQuickAdd({ apply, loaded });

  const readinessProducts = useMemo(
    () =>
      draftSection
        ? buildReadinessProducts(draftSection, isEveryone, crossAuthors)
        : [],
    [draftSection, isEveryone, crossAuthors],
  );
  const submitReadiness = deriveLeadSubmitReadiness({
    draftPayload,
    products: readinessProducts,
    activities: (draftSection?.activities ?? []).map((activity) => ({
      id: activity.activityId,
      name: activity.activityName,
    })),
    stages: buildSubmitStages(draftPayload, readinessProducts),
    ownRisks: draftSection ? mapLeadRisks(draftSection) : [],
    autosaveState: autosave.state,
    submitPending: seam.submitPending,
  });

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    const payload = draftPayload;
    if (!payload) return "no-draft";
    try {
      const saved = await seam.submitSection(
        buildLeadSubmitPayload(payload, versionRef.current),
      );
      setVersionSafe(saved.version);
      setIsSubmitted(true);
      seam.onSubmitSuccess();
      return "submitted";
    } catch (error: unknown) {
      if (isConflictError(error)) {
        handleConflict();
        return "conflict";
      }
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Submit failed",
      );
      return "error";
    }
  }, [draftPayload, seam, setVersionSafe, handleConflict]);

  return {
    draft: draftSection,
    draftPayload,
    dirty: autosave.dirty,
    autosave,
    version,
    isSubmitted,
    setIsSubmitted,
    save: autosave.forceSave,
    submit,
    submitReadiness,
    handleConflict,
    apply,
    ...quickAddCluster,
  };
}
