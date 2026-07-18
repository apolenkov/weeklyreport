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
import type { RiskPrefillRequest } from "./lead-form-sync-bridge";

export interface QuickAddItem {
  readonly week: "current" | "next";
  readonly seq: number;
}

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
 * draft merge behind one handle. Live view-model inputs a callback needs enter
 * as plain render args (`loaded`); the SINGLE module-internal ref (`loadedRef`)
 * bridges render into the quick-add callbacks, so no ref crosses a file boundary.
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
  const [pendingQuickAdd, setPendingQuickAdd] = useState<QuickAddItem | null>(
    null,
  );
  const [pendingRiskPrefill, setPendingRiskPrefill] =
    useState<RiskPrefillRequest | null>(null);
  const lastServerDraftKeyRef = useRef<string | null>(null);
  const pendingSaveEchoesRef = useRef<readonly PendingSaveEcho[]>([]);
  // The one sanctioned render->callback bridge: the live loaded context a
  // quick-add merge callback reads after commit.
  const loadedRef = useRef(loaded);
  // eslint-disable-next-line react-hooks/refs -- the one sanctioned render->callback bridge (see comment above)
  loadedRef.current = loaded;

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

  const routeToBlocker = useCallback(
    (prefill: Omit<RiskPrefillRequest, "signal">) => {
      setPendingRiskPrefill((prev) => ({
        signal: (prev?.signal ?? 0) + 1,
        ...prefill,
      }));
    },
    [],
  );

  const quickAdd = useCallback((week: "current" | "next") => {
    setPendingQuickAdd((prev) => ({ week, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  const clearQuickAdd = useCallback(() => setPendingQuickAdd(null), []);
  const clearRiskPrefill = useCallback(() => setPendingRiskPrefill(null), []);

  const quickAddSave = useCallback(
    (item: LeadFormLoadedContext["currentWeekItems"][number]) => {
      if (!pendingQuickAdd) return;
      const context = loadedRef.current;
      const week = pendingQuickAdd.week;
      const base =
        week === "next" ? context.nextWeekItems : context.currentWeekItems;
      apply({ kind: "week-items", week, items: [...base, item] });
      setPendingQuickAdd(null);
    },
    [pendingQuickAdd, apply],
  );

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
    quickAdd,
    pendingQuickAdd,
    quickAddSave,
    clearQuickAdd,
    routeToBlocker,
    pendingRiskPrefill,
    clearRiskPrefill,
  };
}
