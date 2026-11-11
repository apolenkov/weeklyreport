import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  type AuthorReportSectionReadModel,
  type IncompleteRecordDeletion,
  isCompleteDecision,
  isCompleteRisk,
} from "@weeklyreport/shared";
import { useMemo, useRef } from "react";

import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";

interface SavedRecords {
  readonly reportSectionId: string;
  readonly version: number;
  readonly risks: readonly { readonly stableId?: string | undefined }[];
  readonly decisions: readonly { readonly stableId?: string | undefined }[];
}

const identified = (
  kind: IncompleteRecordDeletion["kind"],
  records: readonly { readonly stableId?: string | undefined }[],
): IncompleteRecordDeletion[] =>
  records.flatMap((record) =>
    record.stableId === undefined ? [] : [{ kind, stableId: record.stableId }],
  );

/** The unfinished risks and decisions a stored section holds. */
export function storedIncompleteRecords(
  section: AuthorReportSectionReadModel,
): IncompleteRecordDeletion[] {
  return [
    ...identified(
      "risk",
      section.risks.filter((risk) => !isCompleteRisk(risk)),
    ),
    ...identified(
      "decision",
      section.decisions.filter((decision) => !isCompleteDecision(decision)),
    ),
  ];
}

/**
 * The stored unfinished records a save no longer carries: the author deleted
 * them on the form, and the server deletes an unfinished record only when the
 * save names it. A saved row cannot leave the payload any other way, because
 * the risk and decision editors refuse an empty name or text before they
 * write to the form.
 */
export function deletionIntentsFor(
  stored: readonly IncompleteRecordDeletion[],
  save: Pick<SavedRecords, "risks" | "decisions">,
): IncompleteRecordDeletion[] {
  const kept = new Set(
    [
      ...identified("risk", save.risks),
      ...identified("decision", save.decisions),
    ].map((record) => `${record.kind}:${record.stableId}`),
  );
  return stored.filter(
    (record) => !kept.has(`${record.kind}:${record.stableId}`),
  );
}

function cachedSections(
  queryClient: QueryClient,
  trpc: ReturnType<typeof useTRPC>,
): AuthorReportSectionReadModel[] {
  return queryClient
    .getQueriesData<{ readonly section?: AuthorReportSectionReadModel }>(
      trpc.leadForm.byPeriod.pathFilter(),
    )
    .flatMap(([, data]) => (data?.section ? [data.section] : []));
}

/**
 * Remembers what the server holds for the sections this form writes. A save
 * is issued against one version, so only the section as stored at exactly
 * that version says which unfinished records the save leaves out; it comes
 * from a write response or the form's read. Capture the derived intent for
 * that version and kept identities for this editor activation: a later read
 * must neither remove nor introduce deletion intent on an uncertain retry.
 * With no such version the save names nothing and the server decides.
 */
export function useStoredDraftLedger() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const written = useRef(new Map<string, AuthorReportSectionReadModel>());
  const captured = useRef(
    new Map<string, readonly IncompleteRecordDeletion[]>(),
  );
  return useMemo(() => {
    const record = (section: AuthorReportSectionReadModel): void => {
      written.current.set(section.reportSectionId, section);
    };
    return {
      record,
      deletionsFor: (save: SavedRecords): IncompleteRecordDeletion[] => {
        // Intent depends only on these identities, never on private prose.
        const key = JSON.stringify({
          section: save.reportSectionId,
          version: save.version,
          kept: [
            ...identified("risk", save.risks),
            ...identified("decision", save.decisions),
          ],
        });
        const existing = captured.current.get(key);
        if (existing) return existing.map((entry) => ({ ...entry }));
        const lastWritten = written.current.get(save.reportSectionId);
        const stored = [
          ...(lastWritten ? [lastWritten] : []),
          ...cachedSections(queryClient, trpc),
        ].find(
          (section) =>
            section.reportSectionId === save.reportSectionId &&
            section.version === save.version,
        );
        const intent = stored
          ? deletionIntentsFor(storedIncompleteRecords(stored), save)
          : [];
        captured.current.set(key, intent);
        return intent.map((entry) => ({ ...entry }));
      },
    };
  }, [queryClient, trpc]);
}
