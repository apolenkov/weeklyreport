import type {
  DraftSaveValidationError,
  IncompleteRecordDeletion,
} from "@weeklyreport/shared";

type RecordKind = IncompleteRecordDeletion["kind"];

/** One stored risk or decision of the section being replaced. */
export interface PersistedRecord {
  readonly kind: RecordKind;
  readonly stableId: string;
  readonly complete: boolean;
}

interface IdentifiedRecord {
  readonly stableId?: string | undefined;
}

/** The risks and decisions a replacement would leave in the section. */
export interface ReplacementRecords {
  readonly risks: readonly IdentifiedRecord[];
  readonly decisions: readonly IdentifiedRecord[];
}

const keyOf = (kind: RecordKind, stableId: string): string =>
  `${kind}:${stableId}`;

const keysOf = (
  kind: RecordKind,
  records: readonly IdentifiedRecord[],
): string[] =>
  records.flatMap((record) =>
    record.stableId === undefined ? [] : [keyOf(kind, record.stableId)],
  );

const OMITTED: DraftSaveValidationError = {
  code: "INCOMPLETE_RECORD_OMITTED",
  message:
    "This save would remove an unfinished risk or decision. Reload the form, then complete the draft or delete it explicitly.",
};

const INVALID_DELETION: DraftSaveValidationError = {
  code: "INCOMPLETE_RECORD_DELETION_INVALID",
  message:
    "A draft marked for deletion is not an unfinished risk or decision of this section. Reload the form and try again.",
};

/**
 * Guards a whole-collection replacement of a section's risks and decisions.
 * A stored incomplete record may leave the section only through an explicit
 * deletion naming its kind and stable identity; a replacement that merely
 * omits it — as a client unaware of incomplete drafts would — is rejected, so
 * an autosave can never erase a draft its author cannot see. A deletion must
 * name a stored incomplete record of this section that the replacement does
 * not also keep. Every writer that replaces the collection calls this under
 * the section's version lock, before any child row is cleared.
 */
export function findIncompleteRecordViolation(
  persisted: readonly PersistedRecord[],
  replacement: ReplacementRecords,
  deletions: readonly IncompleteRecordDeletion[],
): DraftSaveValidationError | null {
  const incomplete = new Set(
    persisted
      .filter((record) => !record.complete)
      .map((record) => keyOf(record.kind, record.stableId)),
  );
  const kept = new Set([
    ...keysOf("risk", replacement.risks),
    ...keysOf("decision", replacement.decisions),
  ]);
  const deleted = deletions.map((intent) =>
    keyOf(intent.kind, intent.stableId),
  );
  const invalid =
    new Set(deleted).size !== deleted.length ||
    deleted.some((key) => kept.has(key) || !incomplete.has(key));
  if (invalid) return INVALID_DELETION;

  const released = new Set(deleted);
  const omitted = [...incomplete].some(
    (key) => !kept.has(key) && !released.has(key),
  );
  return omitted ? OMITTED : null;
}
