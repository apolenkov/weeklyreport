import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { encodeAutosaveComparisonKey } from "../../autosave/autosave-stable-stringify";
import { sectionToDraftPayload } from "../../lead-section-draft-payload";
import type { DecisionEntry, RiskEntry } from "../../types";
import {
  mergeDecisionDraft,
  mergeRiskDraft,
} from "./lead-form-draft-merge-helpers";

type CreatedRecord =
  | { readonly kind: "risk"; readonly entry: RiskEntry }
  | { readonly kind: "decision"; readonly entry: DecisionEntry };

interface RecordPatchContext {
  readonly reportSectionId: string;
  readonly record: CreatedRecord;
}

export type CreatedRecordPatch = RecordPatchContext &
  (
    | { readonly kind: "create-record" | "discard-created-record" }
    | {
        readonly kind: "replace-created-record";
        readonly previous: CreatedRecord;
      }
  );

function canonicalRecord(
  section: ReportSectionReadModel,
  record: CreatedRecord,
): string | undefined {
  const payload = sectionToDraftPayload(section);
  const rows = record.kind === "risk" ? payload.risks : payload.decisions;
  const matches = rows.filter((row) => row.stableId === record.entry.stableId);
  const [row] = matches;
  // Physical ids are recreated on save; lineage and authored payload must match.
  return matches.length === 1 && row
    ? encodeAutosaveComparisonKey({ ...row, id: undefined })
    : undefined;
}

function candidateSection(
  section: ReportSectionReadModel,
  record: CreatedRecord,
): ReportSectionReadModel {
  return record.kind === "risk"
    ? mergeRiskDraft({ ...section, risks: [] }, [record.entry])
    : mergeDecisionDraft({ ...section, decisions: [] }, [record.entry]);
}

export function matchesCreatedRecord(
  section: ReportSectionReadModel,
  record: CreatedRecord,
): boolean {
  const rows = record.kind === "risk" ? section.risks : section.decisions;
  const expected = canonicalRecord(candidateSection(section, record), record);
  return (
    expected !== undefined &&
    rows.filter((row) => row.stableId === record.entry.stableId).length === 1 &&
    canonicalRecord(section, record) === expected
  );
}

function canApply(
  section: ReportSectionReadModel,
  patch: CreatedRecordPatch,
): boolean {
  const { entry } = patch.record;
  return (
    section.status === "draft" &&
    section.reportSectionId === patch.reportSectionId &&
    !entry.foreign &&
    (entry.authorId === undefined || entry.authorId === section.authorId) &&
    Boolean(entry.id && entry.stableId)
  );
}

function replaceCreatedRecord(
  section: ReportSectionReadModel,
  patch: Extract<CreatedRecordPatch, { kind: "replace-created-record" }>,
): ReportSectionReadModel {
  const { record, previous } = patch;
  const stableId = record.entry.stableId;
  if (record.kind !== previous.kind || stableId !== previous.entry.stableId)
    return section;
  if (!matchesCreatedRecord(section, previous)) return section;
  if (record.kind === "risk") {
    const own = section.risks.filter((row) => row.stableId === stableId);
    const [updated] = mergeRiskDraft({ ...section, risks: own }, [
      record.entry,
    ]).risks;
    return updated
      ? {
          ...section,
          risks: section.risks.map((row) =>
            row.stableId === stableId ? updated : row,
          ),
        }
      : section;
  }
  const own = section.decisions.filter((row) => row.stableId === stableId);
  const [updated] = mergeDecisionDraft({ ...section, decisions: own }, [
    record.entry,
  ]).decisions;
  return updated
    ? {
        ...section,
        decisions: section.decisions.map((row) =>
          row.stableId === stableId ? updated : row,
        ),
      }
    : section;
}

function removeCreatedRecord(
  section: ReportSectionReadModel,
  record: CreatedRecord,
): ReportSectionReadModel {
  const stableId = record.entry.stableId;
  return record.kind === "risk"
    ? {
        ...section,
        risks: section.risks.filter((row) => row.stableId !== stableId),
      }
    : {
        ...section,
        decisions: section.decisions.filter((row) => row.stableId !== stableId),
      };
}

/** Applies against the latest raw list, including unfinished/unresolved rows. */
export function applyCreatedRecordPatch(
  section: ReportSectionReadModel,
  patch: CreatedRecordPatch,
): ReportSectionReadModel {
  const { record } = patch;
  const { entry } = record;
  if (!canApply(section, patch)) return section;
  const rows = record.kind === "risk" ? section.risks : section.decisions;
  const candidate = candidateSection(section, record);
  const expected = canonicalRecord(candidate, record);
  if (!expected) return section;
  if (patch.kind === "replace-created-record")
    return replaceCreatedRecord(section, patch);
  if (patch.kind === "create-record") {
    // Repeated intent never overwrites a row that another edit now owns.
    if (
      rows.some((row) => row.id === entry.id || row.stableId === entry.stableId)
    )
      return section;
    return record.kind === "risk"
      ? { ...section, risks: [...section.risks, ...candidate.risks] }
      : {
          ...section,
          decisions: [...section.decisions, ...candidate.decisions],
        };
  }
  if (!matchesCreatedRecord(section, record)) return section;
  return removeCreatedRecord(section, record);
}
