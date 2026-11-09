import { z } from "zod";

// A save carries at most this many risks plus this many decisions, so no more
// identities than that can be deleted by one request.
const MAX_DELETED_INCOMPLETE_RECORDS = 200;

/**
 * The author's explicit intent to delete one incomplete risk or decision.
 * The enclosing section and expected version bind it to one collection, and
 * the stable identity is the key because physical row ids may be reminted.
 */
export const incompleteRecordDeletionSchema = z
  .strictObject({
    kind: z.enum(["risk", "decision"]),
    stableId: z.uuid(),
  })
  .readonly();

/**
 * Deletion intents of one save. Optional so that a client written before the
 * intents existed keeps sending a valid save that deletes nothing.
 */
export const deletedIncompleteRecordsField = z
  .array(incompleteRecordDeletionSchema)
  .max(MAX_DELETED_INCOMPLETE_RECORDS)
  .readonly()
  .optional();

/**
 * Fill From request: the target at its client-loaded version (the fill's
 * optimistic-concurrency check), the source, and the target's unfinished
 * drafts the author agreed to lose.
 */
export const fillFromInputSchema = z.object({
  targetSectionId: z.uuid(),
  sourceSectionId: z.uuid(),
  version: z.number().int().min(1),
  deletedIncompleteRecords: deletedIncompleteRecordsField,
});

/** One explicit deletion of an incomplete risk or decision. */
export type IncompleteRecordDeletion = z.infer<
  typeof incompleteRecordDeletionSchema
>;

interface IdentifiedRecord {
  readonly stableId?: string | undefined;
}

interface DeletionIntentCarrier {
  readonly deletedIncompleteRecords?:
    readonly IncompleteRecordDeletion[] | undefined;
  readonly risks: readonly IdentifiedRecord[];
  readonly decisions: readonly IdentifiedRecord[];
}

/** The deletion intents of a save; a save that names none deletes nothing. */
export const deletedIncompleteRecordsOf = (
  save: Pick<DeletionIntentCarrier, "deletedIncompleteRecords">,
): readonly IncompleteRecordDeletion[] => save.deletedIncompleteRecords ?? [];

const stableIds = (records: readonly IdentifiedRecord[]): ReadonlySet<string> =>
  new Set(records.flatMap((record) => record.stableId ?? []));

const intentKey = (intent: IncompleteRecordDeletion): string =>
  `${intent.kind}:${intent.stableId}`;

/**
 * Rejects a repeated deletion intent and an intent for a record the same save
 * also includes: one request cannot both keep and delete an identity.
 */
export const addDeletionIntentIssues = (
  value: DeletionIntentCarrier,
  ctx: z.RefinementCtx,
): void => {
  const intents = deletedIncompleteRecordsOf(value);
  const included = {
    risk: stableIds(value.risks),
    decision: stableIds(value.decisions),
  };
  const keys = intents.map(intentKey);
  intents.forEach((intent, index) => {
    const path = ["deletedIncompleteRecords", index, "stableId"];
    if (keys.indexOf(intentKey(intent)) !== index) {
      ctx.addIssue({
        code: "custom",
        path,
        message: "A record can be deleted only once per save.",
      });
    }
    if (included[intent.kind].has(intent.stableId)) {
      ctx.addIssue({
        code: "custom",
        path,
        message: "A record cannot be both saved and deleted.",
      });
    }
  });
};
