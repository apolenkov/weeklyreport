"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMemo } from "react";

import type { CrossAuthorRow } from "../../report-sections";
import type { LeadFormDraftSeam } from "./lead-form-draft-seam";
import type { LeadFormGeneration } from "./lead-form-generation";
import { buildReadinessProducts } from "./lead-form-submit-context";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";
import {
  buildLeadSubmitReadiness,
  useLeadFormSubmit,
} from "./use-lead-form-submit";

interface UseLeadFormDraftArgs {
  readonly generation: LeadFormGeneration | null;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string | null;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
  readonly seam: LeadFormDraftSeam;
  // Server-static feed; readiness re-applies its overrides in the Everyone lens.
  readonly crossAuthors: readonly CrossAuthorRow[];
  readonly isEveryone: boolean;
}

// Live view-model enters as plain `loaded` — no ref crosses into this module.
export function useLeadFormDraft({
  generation,
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
  crossAuthors,
  isEveryone,
  seam,
}: UseLeadFormDraftArgs) {
  const { versionRef, setVersionSafe, ...core } = useLeadFormDraftCore({
    generation,
    serverSection,
    sectionIdForActions,
    serverReadOnly,
    refetchSection,
  });

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

  return { ...core, submit, submitReadiness };
}
