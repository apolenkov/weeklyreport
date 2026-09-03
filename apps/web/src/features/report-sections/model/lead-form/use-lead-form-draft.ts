"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMemo } from "react";

import type { CrossAuthorRow } from "../lead-cross-author";
import type { LeadFormGeneration } from "./lead-form-generation";
import {
  buildLeadSubmitReadiness,
  buildReadinessProducts,
} from "./lead-form-submit-context";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { useLeadFormDraftCore } from "./use-lead-form-draft-core";

interface UseLeadFormDraftArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string | null;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
  // Server-static feed; readiness re-applies its overrides in the Everyone lens.
  readonly crossAuthors: readonly CrossAuthorRow[];
  readonly isEveryone: boolean;
}

// Live view-model enters as plain `loaded` — no ref crosses into this module.
export function useLeadFormDraft({
  writePort,
  generation,
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
  crossAuthors,
  isEveryone,
}: UseLeadFormDraftArgs) {
  const core = useLeadFormDraftCore({
    writePort,
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
    submitPending: writePort.pending.submit,
  });
  return { ...core, submitReadiness };
}
