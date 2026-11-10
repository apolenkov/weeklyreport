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
 * The stored unfinished records a save no longer carries. The author removed
 * them (or emptied their text) on the form, and the server deletes an
 * unfinished record only when the save names it.
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
 * from the last write response or, before any write, from the form's read.
 * With no such section the save names nothing and the server decides.
 */
export function useStoredDraftLedger() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const written = useRef(new Map<string, AuthorReportSectionReadModel>());
  return useMemo(
    () => ({
      record: (section: AuthorReportSectionReadModel): void => {
        written.current.set(section.reportSectionId, section);
      },
      deletionsFor: (save: SavedRecords): IncompleteRecordDeletion[] => {
        const lastWritten = written.current.get(save.reportSectionId);
        const stored = [
          ...(lastWritten ? [lastWritten] : []),
          ...cachedSections(queryClient, trpc),
        ].find(
          (section) =>
            section.reportSectionId === save.reportSectionId &&
            section.version === save.version,
        );
        return stored
          ? deletionIntentsFor(storedIncompleteRecords(stored), save)
          : [];
      },
    }),
    [queryClient, trpc],
  );
}
