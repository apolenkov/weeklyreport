"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMemo } from "react";

import type { CrossAuthorRow } from "../../report-sections";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import {
  buildReadinessProducts,
  type LeadFormLoadedContext,
} from "./lead-form-submit-context";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";
import { useLeadFormQuickAdd } from "./use-lead-form-quick-add";
import {
  buildLeadSubmitReadiness,
  useLeadFormSubmit,
} from "./use-lead-form-submit";

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

// Live view-model enters as plain `loaded` — no ref crosses into this module.
/**
 * Use Lead Form Draft.
 * @param props - The props argument.
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
  const { versionRef, setVersionSafe, ...core } = useLeadFormDraftCore({
    serverSection,
    sectionIdForActions,
    serverReadOnly,
    refetchSection,
  });

  // Modal quick-add + blocker-prefill cluster. Kept out of the core because it
  // touches neither the optimistic-lock version nor the dual-state write path.
  const quickAddCluster = useLeadFormQuickAdd({ apply: core.apply, loaded });

  const readinessProducts = useMemo(
    () =>
      core.draft
        ? buildReadinessProducts(core.draft, isEveryone, crossAuthors)
        : [],
    [core.draft, isEveryone, crossAuthors],
  );
  const submitReadiness = buildLeadSubmitReadiness({
    draftSection: core.draft,
    draftPayload: core.draftPayload,
    products: readinessProducts,
    autosaveState: core.autosave.state,
    submitPending: seam.submitPending,
  });
  const submit = useLeadFormSubmit({
    draftPayload: core.draftPayload,
    seam,
    versionRef,
    setVersionSafe,
    setIsSubmitted: core.setIsSubmitted,
    handleConflict: core.handleConflict,
  });

  return { ...core, submit, submitReadiness, ...quickAddCluster };
}
